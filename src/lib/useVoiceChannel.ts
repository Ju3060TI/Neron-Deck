import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { createAudioLevelMonitor, type AudioLevelMonitor } from '@/lib/audioLevel';

export interface VoiceParticipant {
  userId: string;
  profile: Profile | null;
  muted: boolean;
  speaking: boolean;
  stream?: MediaStream;
  screenStream?: MediaStream;
}

export interface ScreenShareState {
  userId: string;
  name: string;
  stream: MediaStream;
  isMe: boolean;
}

type ParticipantState = Omit<VoiceParticipant, 'speaking'>;

interface RemotePeer {
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement | null;
  profile: Profile | null;
  candidates: RTCIceCandidateInit[];
  makingOffer: boolean;
  isInitiator: boolean;
  attempts: number;
  reconnectTimer: number | null;
  ready: boolean;
}

type SignalMsg =
  | { kind: 'join'; sender: string }
  | { kind: 'leave'; sender: string }
  | { kind: 'mute'; sender: string; muted: boolean }
  | { kind: 'description'; sender: string; target: string; description: RTCSessionDescriptionInit }
  | { kind: 'candidate'; sender: string; target: string; candidate: RTCIceCandidateInit }
  | { kind: 'reconnect'; sender: string; target: string };

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 3000;

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  const turnUrls: string | undefined = import.meta.env.VITE_TURN_URL;
  if (turnUrls) {
    servers.push({
      urls: turnUrls.split(',').map((url) => url.trim()).filter(Boolean),
      username: import.meta.env.VITE_TURN_USER,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    });
  }
  return servers;
}

const ICE_SERVERS = buildIceServers();

function acquireMicrophone(deviceId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
}

function teardownPeer(peer: RemotePeer) {
  if (peer.reconnectTimer !== null) window.clearTimeout(peer.reconnectTimer);
  peer.audioEl?.remove();
  peer.pc.close();
}

export function useVoiceChannel() {
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [participantStates, setParticipantStates] = useState<ParticipantState[]>([]);
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [localUserId, setLocalUserId] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const localTrackRef = useRef<MediaStreamTrack | null>(null);
  const peersRef = useRef<Map<string, RemotePeer>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const userIdRef = useRef<string | null>(null);
  const markerRef = useRef<string>(randomId());
  const monitorRef = useRef<AudioLevelMonitor | null>(null);
  const selectedDeviceIdRef = useRef('');
  const localScreenTrackRef = useRef<MediaStreamTrack | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);

  const participants = useMemo<VoiceParticipant[]>(
    () => participantStates.map((p) => ({ ...p, speaking: speakingIds.has(p.userId) })),
    [participantStates, speakingIds]
  );

  const screenShare = useMemo<ScreenShareState | null>(() => {
    if (localScreenStream && localUserId) return { userId: localUserId, name: 'Du', stream: localScreenStream, isMe: true };
    const sharer = participants.find((p) => p.screenStream);
    if (!sharer?.screenStream) return null;
    return {
      userId: sharer.userId,
      name: sharer.profile?.username ?? sharer.profile?.email ?? 'Ein Teilnehmer',
      stream: sharer.screenStream,
      isMe: false,
    };
  }, [localScreenStream, localUserId, participants]);

  const sendSignal = useCallback((msg: SignalMsg) => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({ type: 'broadcast', event: 'voice-signal', payload: { ...msg, marker: markerRef.current } });
  }, []);

  const getProfile = useCallback(async (uid: string): Promise<Profile | null> => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    return (data as Profile) ?? null;
  }, []);

  const refreshAudioInputs = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    setAudioInputs(devices.filter((d) => d.kind === 'audioinput' && d.deviceId !== ''));
  }, []);

  useEffect(() => {
    void refreshAudioInputs();
    navigator.mediaDevices.addEventListener('devicechange', refreshAudioInputs);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshAudioInputs);
  }, [refreshAudioInputs]);

  const upsertParticipant = useCallback((uid: string, patch: Partial<ParticipantState>) => {
    setParticipantStates((prev) => {
      const idx = prev.findIndex((p) => p.userId === uid);
      if (idx === -1) return [...prev, { userId: uid, profile: patch.profile ?? null, muted: patch.muted ?? false, stream: patch.stream }];
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const removeParticipantState = useCallback((uid: string) => {
    setParticipantStates((prev) => prev.filter((p) => p.userId !== uid));
  }, []);

  const closePeer = useCallback((uid: string) => {
    const peer = peersRef.current.get(uid);
    if (peer) {
      teardownPeer(peer);
      peersRef.current.delete(uid);
    }
    monitorRef.current?.detach(uid);
    removeParticipantState(uid);
  }, [removeParticipantState]);

  const scheduleReconnect = useCallback((uid: string) => {
    const peer = peersRef.current.get(uid);
    if (!peer || peer.reconnectTimer !== null) return;
    if (peer.attempts >= MAX_RECONNECT_ATTEMPTS) {
      setError(`Verbindung zu ${peer.profile?.username ?? 'einem Teilnehmer'} konnte nicht wiederhergestellt werden.`);
      closePeer(uid);
      return;
    }
    peer.reconnectTimer = window.setTimeout(() => {
      const current = peersRef.current.get(uid);
      if (!current) return;
      current.reconnectTimer = null;
      if (current.pc.connectionState === 'connected') return;
      current.attempts += 1;
      if (current.isInitiator) {
        current.pc.restartIce();
      } else {
        const myUid = userIdRef.current;
        if (myUid) sendSignal({ kind: 'reconnect', sender: myUid, target: uid });
      }
    }, RECONNECT_DELAY_MS);
  }, [closePeer, sendSignal]);

  const createPeer = useCallback(
    (remoteUid: string, remoteProfile: Profile | null, isInitiator: boolean): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const peer: RemotePeer = {
        pc,
        audioEl: null,
        profile: remoteProfile,
        candidates: [],
        makingOffer: false,
        isInitiator,
        attempts: 0,
        reconnectTimer: null,
        ready: false,
      };
      peersRef.current.set(remoteUid, peer);
      upsertParticipant(remoteUid, { profile: remoteProfile });

      pc.ontrack = (e) => {
        if (e.track.kind === 'video') {
          const screen = e.streams[0] ?? new MediaStream([e.track]);
          screen.onremovetrack = () => {
            if (screen.getVideoTracks().length === 0) upsertParticipant(remoteUid, { screenStream: undefined });
          };
          upsertParticipant(remoteUid, { screenStream: screen });
          return;
        }
        const stream = e.streams[0];
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        audio.play().catch(() => {});
        peer.audioEl = audio;
        monitorRef.current?.attach(remoteUid, stream);
        upsertParticipant(remoteUid, { stream });
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal({ kind: 'candidate', sender: userIdRef.current!, target: remoteUid, candidate: e.candidate.toJSON() });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          peer.attempts = 0;
          peer.ready = true;
          if (peer.reconnectTimer !== null) {
            window.clearTimeout(peer.reconnectTimer);
            peer.reconnectTimer = null;
          }
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          scheduleReconnect(remoteUid);
        }
      };

      const track = localTrackRef.current;
      if (track) {
        pc.addTrack(track, localStreamRef.current ?? new MediaStream([track]));
      }

      const screenTrack = localScreenTrackRef.current;
      if (screenTrack && localScreenStreamRef.current) {
        pc.addTrack(screenTrack, localScreenStreamRef.current);
      }

        pc.onnegotiationneeded = async () => {
          if (!isInitiator && !peer.ready) return;
          try {
            peer.makingOffer = true;
            await pc.setLocalDescription();
            sendSignal({ kind: 'description', sender: userIdRef.current!, target: remoteUid, description: pc.localDescription!.toJSON() });
          } catch {
            // ignore
          } finally {
            peer.makingOffer = false;
          }
        };

      return pc;
    },
    [sendSignal, upsertParticipant, scheduleReconnect]
  );

  const handleSignal = useCallback(
    async (msg: SignalMsg & { marker?: string }) => {
      if (msg.marker === markerRef.current) return; // skip our own
      const myUid = userIdRef.current;
      if (!myUid) return;

      if (msg.kind === 'join') {
        if (msg.sender === myUid) return;
        if (peersRef.current.has(msg.sender)) return;
        const profile = await getProfile(msg.sender);
        createPeer(msg.sender, profile, true);
        // Reply so the newcomer connects back to us
        sendSignal({ kind: 'join', sender: myUid });
      } else if (msg.kind === 'leave') {
        if (msg.sender === myUid) return;
        closePeer(msg.sender);
      } else if (msg.kind === 'mute') {
        if (msg.sender === myUid) return;
        upsertParticipant(msg.sender, { muted: msg.muted });
      } else if (msg.kind === 'description') {
        if (msg.target !== myUid) return;
        if (msg.sender === myUid) return;
        let peer = peersRef.current.get(msg.sender);
        if (!peer) {
          const profile = await getProfile(msg.sender);
          createPeer(msg.sender, profile, false);
          peer = peersRef.current.get(msg.sender)!;
        }
        const collision = msg.description.type === 'offer' && (peer.makingOffer || peer.pc.signalingState !== 'stable');
        if (collision && msg.sender > myUid) return; // glare: higher uid wins
        try {
          await peer.pc.setRemoteDescription(msg.description);
          for (const c of peer.candidates) await peer.pc.addIceCandidate(c);
          peer.candidates = [];
          if (msg.description.type === 'offer') {
            await peer.pc.setLocalDescription();
            sendSignal({ kind: 'description', sender: myUid, target: msg.sender, description: peer.pc.localDescription!.toJSON() });
          }
        } catch {
          // ignore signaling errors
        }
      } else if (msg.kind === 'candidate') {
        if (msg.target !== myUid) return;
        if (msg.sender === myUid) return;
        const peer = peersRef.current.get(msg.sender);
        if (!peer) return;
        if (peer.pc.remoteDescription) {
          peer.pc.addIceCandidate(msg.candidate).catch(() => {});
        } else {
          peer.candidates.push(msg.candidate);
        }
      } else if (msg.kind === 'reconnect') {
        if (msg.target !== myUid) return;
        const peer = peersRef.current.get(msg.sender);
        if (peer?.isInitiator) peer.pc.restartIce();
      }
    },
    [sendSignal, createPeer, closePeer, getProfile, upsertParticipant]
  );

  const joinVoice = useCallback(
    async (channelId: string, userId: string, profile: Profile | null) => {
      if (joined || connecting) return;
      setConnecting(true);
      setError(null);
      try {
        const stream = await acquireMicrophone(selectedDeviceIdRef.current);
        localStreamRef.current = stream;
        localTrackRef.current = stream.getAudioTracks()[0] ?? null;

        userIdRef.current = userId;
        markerRef.current = randomId();

        const monitor = createAudioLevelMonitor((ids) => setSpeakingIds(ids));
        monitorRef.current = monitor;
        monitor.attach(userId, stream);
        void refreshAudioInputs();

        const signalChannel = `voice:${channelId}`;
        const ch = supabase.channel(signalChannel, {
          config: { broadcast: { self: false }, presence: { key: userId } },
        });
        channelRef.current = ch;

        ch.on('broadcast', { event: 'voice-signal' }, ({ payload }) => {
          void handleSignal(payload as SignalMsg & { marker?: string });
        });

        ch.on('presence', { event: 'sync' }, () => {
          const state = ch.presenceState<{ userId: string }>();
          const presentIds = Object.keys(state).filter((id) => id !== userId);
          for (const [remoteUid] of peersRef.current) {
            if (!presentIds.includes(remoteUid)) closePeer(remoteUid);
          }
        });

        ch.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await ch.track({ userId });
            sendSignal({ kind: 'join', sender: userId });
          }
        });

        setJoined(true);
        setParticipantStates([{ userId, profile, muted: false, stream }]);
        setLocalUserId(userId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Mikrofon konnte nicht geöffnet werden.';
        setError(msg);
        setJoined(false);
      } finally {
        setConnecting(false);
      }
    },
    [joined, connecting, sendSignal, handleSignal, closePeer, refreshAudioInputs]
  );

  const stopScreenShare = useCallback(() => {
    const track = localScreenTrackRef.current;
    if (!track) return;
    for (const peer of peersRef.current.values()) {
      const sender = peer.pc.getSenders().find((s) => s.track === track);
      if (sender) peer.pc.removeTrack(sender);
    }
    track.stop();
    localScreenTrackRef.current = null;
    localScreenStreamRef.current = null;
    setLocalScreenStream(null);
  }, []);

  const startScreenShare = useCallback(async () => {
    if (localScreenTrackRef.current || !userIdRef.current) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'NotAllowedError')) {
        setError('Bildschirmfreigabe konnte nicht gestartet werden.');
      }
      return;
    }
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    track.onended = () => stopScreenShare();
    localScreenTrackRef.current = track;
    localScreenStreamRef.current = stream;
    for (const peer of peersRef.current.values()) peer.pc.addTrack(track, stream);
    setLocalScreenStream(stream);
  }, [stopScreenShare]);

  const leaveVoice = useCallback(() => {
    const myUid = userIdRef.current;
    if (myUid) sendSignal({ kind: 'leave', sender: myUid });
    stopScreenShare();

    for (const peer of peersRef.current.values()) teardownPeer(peer);
    peersRef.current.clear();

    monitorRef.current?.dispose();
    monitorRef.current = null;
    setSpeakingIds(new Set());

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    localTrackRef.current = null;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    userIdRef.current = null;
    setJoined(false);
    setParticipantStates([]);
    setLocalUserId(null);
    setMuted(false);
  }, [sendSignal, stopScreenShare]);

  const toggleMute = useCallback(() => {
    const track = localTrackRef.current;
    if (!track) return;
    const newEnabled = !track.enabled;
    track.enabled = newEnabled;
    setMuted(!newEnabled);
    const myUid = userIdRef.current;
    if (myUid) sendSignal({ kind: 'mute', sender: myUid, muted: !newEnabled });
  }, [sendSignal]);

  const selectInputDevice = useCallback(async (deviceId: string) => {
    selectedDeviceIdRef.current = deviceId;
    setSelectedDeviceId(deviceId);
    const myUid = userIdRef.current;
    if (!myUid || !localStreamRef.current) return;

    try {
      const stream = await acquireMicrophone(deviceId);
      const track = stream.getAudioTracks()[0];
      const previous = localTrackRef.current;
      track.enabled = previous?.enabled ?? true;

      for (const peer of peersRef.current.values()) {
        const sender = peer.pc.getSenders().find((s) => s.track !== null && s.track === previous);
        await sender?.replaceTrack(track);
      }

      previous?.stop();
      localStreamRef.current = stream;
      localTrackRef.current = track;
      monitorRef.current?.attach(myUid, stream);
      void refreshAudioInputs();
    } catch {
      setError('Das gewählte Mikrofon konnte nicht geöffnet werden.');
    }
  }, [refreshAudioInputs]);

  useEffect(() => {
    return () => {
      if (joined) leaveVoice();
    };
  }, [joined, leaveVoice]);

  return {
    joined,
    connecting,
    muted,
    participants,
    error,
    audioInputs,
    selectedDeviceId,
    joinVoice,
    leaveVoice,
    toggleMute,
    selectInputDevice,
    isSharingScreen: localScreenStream !== null,
    screenShare,
    screenShareSupported: typeof navigator.mediaDevices?.getDisplayMedia === 'function',
    startScreenShare,
    stopScreenShare,
  };
}
