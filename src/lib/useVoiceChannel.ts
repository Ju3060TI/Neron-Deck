import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

export interface VoiceParticipant {
  userId: string;
  profile: Profile | null;
  muted: boolean;
  stream?: MediaStream;
}

interface RemotePeer {
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement | null;
  profile: Profile | null;
  candidates: RTCIceCandidateInit[];
  makingOffer: boolean;
}

type SignalMsg =
  | { kind: 'join'; sender: string }
  | { kind: 'leave'; sender: string }
  | { kind: 'mute'; sender: string; muted: boolean }
  | { kind: 'description'; sender: string; target: string; description: RTCSessionDescriptionInit }
  | { kind: 'candidate'; sender: string; target: string; candidate: RTCIceCandidateInit };

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useVoiceChannel() {
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const localTrackRef = useRef<MediaStreamTrack | null>(null);
  const peersRef = useRef<Map<string, RemotePeer>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const profileRef = useRef<Profile | null>(null);
  const markerRef = useRef<string>(randomId());

  const sendSignal = useCallback((msg: SignalMsg) => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({ type: 'broadcast', event: 'voice-signal', payload: { ...msg, marker: markerRef.current } });
  }, []);

  const getProfile = useCallback(async (uid: string): Promise<Profile | null> => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    return (data as Profile) ?? null;
  }, []);

  const upsertParticipant = useCallback((uid: string, patch: Partial<VoiceParticipant>) => {
    setParticipants((prev) => {
      const idx = prev.findIndex((p) => p.userId === uid);
      if (idx === -1) return [...prev, { userId: uid, profile: patch.profile ?? null, muted: patch.muted ?? false, stream: patch.stream }];
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const removeParticipantState = useCallback((uid: string) => {
    setParticipants((prev) => prev.filter((p) => p.userId !== uid));
  }, []);

  const closePeer = useCallback((uid: string) => {
    const peer = peersRef.current.get(uid);
    if (peer) {
      peer.audioEl?.remove();
      peer.pc.close();
      peersRef.current.delete(uid);
    }
    removeParticipantState(uid);
  }, [removeParticipantState]);

  const createPeer = useCallback(
    (remoteUid: string, remoteProfile: Profile | null, isInitiator: boolean): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const peer: RemotePeer = { pc, audioEl: null, profile: remoteProfile, candidates: [], makingOffer: false };
      peersRef.current.set(remoteUid, peer);
      upsertParticipant(remoteUid, { profile: remoteProfile });

      pc.ontrack = (e) => {
        const stream = e.streams[0];
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        audio.play().catch(() => {});
        peer.audioEl = audio;
        upsertParticipant(remoteUid, { stream });
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal({ kind: 'candidate', sender: userIdRef.current!, target: remoteUid, candidate: e.candidate.toJSON() });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          closePeer(remoteUid);
        }
      };

      const track = localTrackRef.current;
      if (track) {
        pc.addTrack(track, localStreamRef.current ?? new MediaStream([track]));
      }

      if (isInitiator) {
        pc.onnegotiationneeded = async () => {
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
      }

      return pc;
    },
    [sendSignal, upsertParticipant, closePeer]
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
          const pc = createPeer(msg.sender, profile, false);
          peer = peersRef.current.get(msg.sender)!;
          void pc; // peer created and stored
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
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
        localStreamRef.current = stream;
        localTrackRef.current = stream.getAudioTracks()[0] ?? null;

        channelIdRef.current = channelId;
        userIdRef.current = userId;
        profileRef.current = profile;
        markerRef.current = randomId();

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
        setParticipants([{ userId, profile, muted: false, stream }]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not access microphone';
        setError(msg);
        setJoined(false);
      } finally {
        setConnecting(false);
      }
    },
    [joined, connecting, sendSignal, handleSignal, closePeer]
  );

  const leaveVoice = useCallback(() => {
    const myUid = userIdRef.current;
    if (myUid) sendSignal({ kind: 'leave', sender: myUid });

    for (const [, peer] of peersRef.current) {
      peer.audioEl?.remove();
      peer.pc.close();
    }
    peersRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    localTrackRef.current = null;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    channelIdRef.current = null;
    userIdRef.current = null;
    setJoined(false);
    setParticipants([]);
    setMuted(false);
  }, [sendSignal]);

  const toggleMute = useCallback(() => {
    const track = localTrackRef.current;
    if (!track) return;
    const newEnabled = !track.enabled;
    track.enabled = newEnabled;
    setMuted(!newEnabled);
    const myUid = userIdRef.current;
    if (myUid) sendSignal({ kind: 'mute', sender: myUid, muted: !newEnabled });
  }, [sendSignal]);

  useEffect(() => {
    return () => {
      if (joined) leaveVoice();
    };
  }, [joined, leaveVoice]);

  return { joined, connecting, muted, participants, error, joinVoice, leaveVoice, toggleMute };
}
