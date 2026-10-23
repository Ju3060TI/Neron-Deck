import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SendHorizonal, Search, Loader2, AlertCircle, X, UserPlus,
  Check, MessageSquare, Users, Bell, ArrowLeft, XCircle, Hash,
  Plus, Compass, Copy,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type {
  Profile, Friendship, DirectMessage,
  Server, Channel, ServerMember, ServerMessage,
} from '@/lib/types';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name: string): string {
  const parts = name.split(/[._ -]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function genInviteCode(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface FriendWithProfile extends Friendship {
  profile: Profile;
}

type ViewMode = 'servers' | 'dms';

export default function ChatPage() {
  const { user } = useAuth();
  // Top-level view: servers vs DMs
  const [viewMode, setViewMode] = useState<ViewMode>('servers');

  // ===== Servers =====
  const [joinedServers, setJoinedServers] = useState<Server[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [serverMessages, setServerMessages] = useState<ServerMessage[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingServerMessages, setLoadingServerMessages] = useState(false);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [serverSearchQuery, setServerSearchQuery] = useState('');
  const [serverSearchResults, setServerSearchResults] = useState<Server[]>([]);
  const [searchingServers, setSearchingServers] = useState(false);
  const [creatingServer, setCreatingServer] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  // ===== DMs / Friends =====
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendWithProfile[]>([]);
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingDmMessages, setLoadingDmMessages] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendUsername, setFriendUsername] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [showRequests, setShowRequests] = useState(false);

  // ===== Shared =====
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | null>(null);

  const activeServer = useMemo(
    () => joinedServers.find((s) => s.id === activeServerId) ?? null,
    [joinedServers, activeServerId]
  );

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? null,
    [channels, activeChannelId]
  );

  const activeFriend = useMemo(
    () => friends.find((f) => f.profile.id === activeFriendId) ?? null,
    [friends, activeFriendId]
  );

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [serverMessages, dmMessages]);

  // ===== Fetch joined servers =====
  const fetchServers = useCallback(async () => {
    if (!user) return;
    setLoadingServers(true);
    // Get servers where user is a member
    const { data: memberships } = await supabase
      .from('server_members')
      .select('server_id')
      .eq('user_id', user.id);
    const serverIds = (memberships ?? []).map((m) => m.server_id);
    // Also include servers the user owns (in case not in members yet)
    const { data: ownedServers } = await supabase
      .from('servers')
      .select('*')
      .eq('owner_id', user.id);
    const ownedIds = (ownedServers ?? []).map((s) => s.id);
    const allIds = [...new Set([...serverIds, ...ownedIds])];

    if (allIds.length === 0) {
      setJoinedServers([]);
      setLoadingServers(false);
      return;
    }
    const { data: serverData } = await supabase
      .from('servers')
      .select('*')
      .in('id', allIds)
      .order('created_at', { ascending: true });
    setJoinedServers((serverData ?? []) as Server[]);
    setLoadingServers(false);
  }, [user]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  // ===== Fetch channels for active server =====
  const fetchChannels = useCallback(async () => {
    if (!activeServerId) {
      setChannels([]);
      return;
    }
    setLoadingChannels(true);
    const { data } = await supabase
      .from('channels')
      .select('*')
      .eq('server_id', activeServerId)
      .order('created_at', { ascending: true });
    setChannels((data ?? []) as Channel[]);
    setLoadingChannels(false);
  }, [activeServerId]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Auto-select first channel
  useEffect(() => {
    if (channels.length > 0 && !channels.find((c) => c.id === activeChannelId)) {
      setActiveChannelId(channels[0].id);
    } else if (channels.length === 0) {
      setActiveChannelId(null);
    }
  }, [channels, activeChannelId]);

  // ===== Fetch server messages =====
  const fetchServerMessages = useCallback(async () => {
    if (!activeChannelId) {
      setServerMessages([]);
      return;
    }
    setLoadingServerMessages(true);
    const { data, error: err } = await supabase
      .from('server_messages')
      .select('*')
      .eq('channel_id', activeChannelId)
      .order('created_at', { ascending: true });
    if (err) {
      setError('Could not load messages.');
    } else {
      setServerMessages((data ?? []) as ServerMessage[]);
    }
    setLoadingServerMessages(false);
  }, [activeChannelId]);

  useEffect(() => {
    if (viewMode === 'servers') fetchServerMessages();
  }, [fetchServerMessages, viewMode]);

  // ===== Fetch friends =====
  const fetchFriends = useCallback(async () => {
    if (!user) return;
    setLoadingFriends(true);
    const { data: acceptedData } = await supabase
      .from('friendships')
      .select('*')
      .eq('status', 'accepted')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
    const accepted = (acceptedData ?? []) as Friendship[];
    const profileIds = accepted.map((f) => (f.sender_id === user.id ? f.receiver_id : f.sender_id));
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .in('id', profileIds);
    const profileMap = new Map((profilesData ?? []).map((p) => [p.id, p as Profile]));
    const friendsList: FriendWithProfile[] = accepted
      .map((f) => {
        const otherId = f.sender_id === user.id ? f.receiver_id : f.sender_id;
        const profile = profileMap.get(otherId);
        return profile ? { ...f, profile } : null;
      })
      .filter((f): f is FriendWithProfile => f !== null);
    setFriends(friendsList);

    const { data: pendingData } = await supabase
      .from('friendships')
      .select('*')
      .eq('status', 'pending')
      .eq('receiver_id', user.id);
    const pending = (pendingData ?? []) as Friendship[];
    const senderIds = pending.map((f) => f.sender_id);
    const { data: senderProfiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', senderIds);
    const senderMap = new Map((senderProfiles ?? []).map((p) => [p.id, p as Profile]));
    const pendingList: FriendWithProfile[] = pending
      .map((f) => {
        const profile = senderMap.get(f.sender_id);
        return profile ? { ...f, profile } : null;
      })
      .filter((f): f is FriendWithProfile => f !== null);
    setPendingRequests(pendingList);
    setLoadingFriends(false);
  }, [user]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // ===== Fetch DM messages =====
  const fetchDmMessages = useCallback(async () => {
    if (!activeFriendId || !user) return;
    setLoadingDmMessages(true);
    const { data, error: err } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${activeFriendId}),and(sender_id.eq.${activeFriendId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });
    if (err) {
      setError('Could not load messages.');
    } else {
      setDmMessages((data ?? []) as DirectMessage[]);
    }
    setLoadingDmMessages(false);
  }, [activeFriendId, user]);

  useEffect(() => {
    if (viewMode === 'dms') fetchDmMessages();
  }, [fetchDmMessages, viewMode]);

  // ===== Server actions =====
  async function createServer() {
    const name = newServerName.trim();
    if (!name || !user) return;
    setCreatingServer(true);
    const code = genInviteCode();
    const { data, error: err } = await supabase
      .from('servers')
      .insert({ name, owner_id: user.id, invite_code: code })
      .select('*')
      .single();
    if (err || !data) {
      showToast('Could not create server.');
      setCreatingServer(false);
      return;
    }
    // Add owner as member
    await supabase
      .from('server_members')
      .insert({ server_id: data.id, user_id: user.id });
    setJoinedServers((prev) => [...prev, data as Server]);
    setActiveServerId(data.id);
    setViewMode('servers');
    setNewServerName('');
    setShowCreateServer(false);
    setCreatingServer(false);
    showToast(`Server "${name}" created! Invite code: ${code}`);
  }

  async function searchServers() {
    const q = serverSearchQuery.trim();
    if (!q) {
      setServerSearchResults([]);
      return;
    }
    setSearchingServers(true);
    const { data } = await supabase
      .from('servers')
      .select('*')
      .ilike('name', `%${q}%`)
      .limit(10);
    setServerSearchResults((data ?? []) as Server[]);
    setSearchingServers(false);
  }

  async function joinServer(server: Server) {
    if (!user) return;
    // Check if already a member
    const { data: existing } = await supabase
      .from('server_members')
      .select('*')
      .eq('server_id', server.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) {
      showToast('You are already a member of this server.');
      return;
    }
    const { error: err } = await supabase
      .from('server_members')
      .insert({ server_id: server.id, user_id: user.id });
    if (err) {
      showToast('Could not join server.');
      return;
    }
    setJoinedServers((prev) => {
      if (prev.find((s) => s.id === server.id)) return prev;
      return [...prev, server];
    });
    setActiveServerId(server.id);
    setViewMode('servers');
    setShowCreateServer(false);
    setServerSearchQuery('');
    setServerSearchResults([]);
    showToast(`Joined "${server.name}"!`);
  }

  async function joinByInviteCode(code: string) {
    if (!user || !code.trim()) return;
    const { data: server } = await supabase
      .from('servers')
      .select('*')
      .eq('invite_code', code.trim())
      .maybeSingle();
    if (!server) {
      showToast('Invalid invite code.');
      return;
    }
    await joinServer(server as Server);
  }

  async function createChannel() {
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name || !activeServerId) return;
    const { data, error: err } = await supabase
      .from('channels')
      .insert({ server_id: activeServerId, name })
      .select('*')
      .single();
    if (err || !data) {
      showToast('Could not create channel.');
      return;
    }
    setChannels((prev) => [...prev, data as Channel]);
    setActiveChannelId(data.id);
    setNewChannelName('');
    setShowCreateChannel(false);
  }

  // ===== Friend actions =====
  async function handleSearchUser() {
    const q = friendUsername.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${q}%`)
      .neq('id', user?.id ?? '')
      .limit(10);
    setSearchResults((data ?? []) as Profile[]);
    setSearching(false);
  }

  async function sendFriendRequest(profile: Profile) {
    if (!user) return;
    const { data: existing } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${user.id})`)
      .maybeSingle();
    if (existing) {
      showToast('Friend request already exists.');
      return;
    }
    const { error: err } = await supabase
      .from('friendships')
      .insert({ sender_id: user.id, receiver_id: profile.id, status: 'pending' });
    if (err) {
      showToast('Could not send friend request.');
      return;
    }
    showToast(`Friend request sent to ${profile.username ?? profile.email}.`);
    setFriendUsername('');
    setSearchResults([]);
  }

  async function acceptRequest(friendshipId: string, profile: Profile) {
    const { error: err } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    if (err) {
      showToast('Could not accept request.');
      return;
    }
    showToast(`You are now friends with ${profile.username ?? profile.email}.`);
    fetchFriends();
  }

  async function declineRequest(friendshipId: string) {
    const { error: err } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    if (err) {
      showToast('Could not decline request.');
      return;
    }
    setPendingRequests((prev) => prev.filter((r) => r.id !== friendshipId));
  }

  // ===== Send message =====
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || !user) return;

    if (viewMode === 'servers' && activeChannelId) {
      setSending(true);
      setInput('');
      const { data, error: err } = await supabase
        .from('server_messages')
        .insert({ channel_id: activeChannelId, user_id: user.id, content: text })
        .select('*')
        .single();
      if (err) {
        setError('Failed to send message.');
        setInput(text);
      } else if (data) {
        setServerMessages((prev) => [...prev, data as ServerMessage]);
      }
      setSending(false);
    } else if (viewMode === 'dms' && activeFriendId) {
      setSending(true);
      setInput('');
      const { data, error: err } = await supabase
        .from('direct_messages')
        .insert({ sender_id: user.id, receiver_id: activeFriendId, content: text })
        .select('*')
        .single();
      if (err) {
        setError('Failed to send message.');
        setInput(text);
      } else if (data) {
        setDmMessages((prev) => [...prev, data as DirectMessage]);
      }
      setSending(false);
    }
  }

  // ===== Grouped messages for DM =====
  const groupedDmMessages = useMemo(() => {
    const groups: { day: string; label: string; items: DirectMessage[] }[] = [];
    for (const msg of dmMessages) {
      const day = new Date(msg.created_at).toDateString();
      const last = groups[groups.length - 1];
      if (last && last.day === day) {
        last.items.push(msg);
      } else {
        groups.push({ day, label: formatDayLabel(msg.created_at), items: [msg] });
      }
    }
    return groups;
  }, [dmMessages]);

  const groupedServerMessages = useMemo(() => {
    const groups: { day: string; label: string; items: ServerMessage[] }[] = [];
    for (const msg of serverMessages) {
      const day = new Date(msg.created_at).toDateString();
      const last = groups[groups.length - 1];
      if (last && last.day === day) {
        last.items.push(msg);
      } else {
        groups.push({ day, label: formatDayLabel(msg.created_at), items: [msg] });
      }
    }
    return groups;
  }, [serverMessages]);

  const currentMessages = viewMode === 'servers' ? groupedServerMessages : groupedDmMessages;
  const loadingCurrent = viewMode === 'servers' ? loadingServerMessages : loadingDmMessages;
  const isMe = (msgUserId: string) => msgUserId === user?.id;

  return (
    <div className="h-[calc(100vh-3.5rem)] md:h-screen flex relative bg-zinc-950">
      {/* Toast */}
      {toast && (
        <div className="absolute top-4 right-4 z-50 max-w-sm">
          <div className="flex items-start gap-2 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 shadow-xl">
            <Check className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
            <span className="text-sm text-zinc-200">{toast}</span>
            <button onClick={() => setToast(null)} className="ml-auto text-zinc-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ===== Far-left sidebar — server list ===== */}
      <div className="hidden md:flex w-20 shrink-0 bg-zinc-950 border-r border-zinc-800/80 flex-col items-center py-3 gap-2 overflow-y-auto">
        {/* DMs button */}
        <button
          onClick={() => {
            setViewMode('dms');
            setActiveServerId(null);
            setMobileThreadOpen(false);
          }}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
            viewMode === 'dms'
              ? 'bg-blue-600 rounded-xl text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-blue-600 hover:rounded-xl hover:text-white'
          }`}
          title="Direct Messages"
        >
          <MessageSquare className="w-5 h-5" />
        </button>

        <div className="w-8 h-px bg-zinc-800 my-1" />

        {/* Server icons */}
        {loadingServers ? (
          <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
        ) : (
          joinedServers.map((server) => {
            const active = viewMode === 'servers' && activeServerId === server.id;
            return (
              <button
                key={server.id}
                onClick={() => {
                  setViewMode('servers');
                  setActiveServerId(server.id);
                  setMobileThreadOpen(false);
                }}
                className={`relative w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold transition-all shrink-0 ${
                  active
                    ? 'bg-blue-600 rounded-xl text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-blue-600 hover:rounded-xl hover:text-white'
                }`}
                title={server.name}
              >
                {server.name.slice(0, 1).toUpperCase()}
                {/* Active indicator */}
                <span
                  className={`absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 rounded-r-full transition-all ${
                    active ? 'h-8 bg-white' : 'h-2 bg-zinc-600 group-hover:h-4'
                  }`}
                />
              </button>
            );
          })
        )}

        {/* + Create / search server */}
        <button
          onClick={() => setShowCreateServer(true)}
          className="w-12 h-12 rounded-2xl flex items-center justify-center bg-zinc-800 text-emerald-400 hover:bg-emerald-600 hover:rounded-xl hover:text-white transition-all shrink-0"
          title="Create or join a server"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* ===== Middle sidebar — channels or DM list ===== */}
      <div className={`w-60 shrink-0 bg-zinc-900/80 border-r border-zinc-800 flex flex-col h-full ${mobileThreadOpen ? 'hidden md:flex' : 'flex'}`}>
        {viewMode === 'servers' && activeServer ? (
          <>
            {/* Server header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-800 shrink-0">
              <h2 className="text-sm font-semibold text-white truncate">{activeServer.name}</h2>
              {activeServer.owner_id === user?.id && (
                <button
                  onClick={() => setShowCreateChannel(true)}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  title="Create channel"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* Channel list */}
            <div className="flex-1 overflow-y-auto py-2 px-2">
              {loadingChannels ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                </div>
              ) : channels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <Hash className="w-8 h-8 text-zinc-700 mb-3" strokeWidth={1.5} />
                  <p className="text-sm text-zinc-500">No channels yet</p>
                  {activeServer.owner_id === user?.id && (
                    <p className="text-xs text-zinc-600 mt-1">Click + to create one.</p>
                  )}
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {channels.map((ch) => {
                    const active = activeChannelId === ch.id;
                    return (
                      <li key={ch.id}>
                        <button
                          onClick={() => {
                            setActiveChannelId(ch.id);
                            setMobileThreadOpen(true);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                            active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                          }`}
                        >
                          <Hash className="w-4 h-4 text-zinc-500 shrink-0" />
                          <span className="truncate">{ch.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        ) : (
          <>
            {/* DM header */}
            <div className="flex items-center gap-2 px-4 h-14 border-b border-zinc-800 shrink-0">
              <h2 className="text-sm font-semibold text-white">Direct Messages</h2>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => setShowRequests(true)}
                  className="relative p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  aria-label="Friend requests"
                >
                  <Bell className="w-4 h-4" />
                  {pendingRequests.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {pendingRequests.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowAddFriend(true)}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  aria-label="Add friend"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Friends list */}
            <div className="flex-1 overflow-y-auto">
              {loadingFriends ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                </div>
              ) : friends.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <Users className="w-10 h-10 text-zinc-700 mb-3" strokeWidth={1.5} />
                  <p className="text-sm text-zinc-400">No friends yet</p>
                  <p className="text-xs text-zinc-600 mt-1">Click + above to add a friend.</p>
                </div>
              ) : (
                <ul className="py-1">
                  {friends.map((f) => {
                    const active = activeFriendId === f.profile.id;
                    const name = f.profile.username ?? f.profile.email;
                    return (
                      <li key={f.id}>
                        <button
                          onClick={() => {
                            setActiveFriendId(f.profile.id);
                            setMobileThreadOpen(true);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                            active ? 'bg-zinc-800/80 border-l-2 border-blue-500' : 'border-l-2 border-transparent hover:bg-zinc-800/40'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${active ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-300'}`}>
                            {initials(name)}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${active ? 'text-white' : 'text-zinc-200'}`}>
                              {f.profile.username ?? name}
                            </p>
                            <p className="text-[11px] text-zinc-600 truncate">{f.profile.email}</p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {/* ===== Right side — chat ===== */}
      <div className={`flex-1 flex flex-col h-full min-w-0 ${mobileThreadOpen ? 'flex' : 'hidden md:flex'}`}>
        {/* Chat header */}
        {(viewMode === 'servers' && activeChannel) || (viewMode === 'dms' && activeFriend) ? (
          <>
            <div className="flex items-center gap-3 px-5 h-14 border-b border-zinc-800 bg-zinc-900/40 shrink-0">
              {mobileThreadOpen && (
                <button
                  onClick={() => setMobileThreadOpen(false)}
                  className="md:hidden p-1 -ml-1 text-zinc-400 hover:text-white"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              {viewMode === 'servers' && activeChannel ? (
                <>
                  <Hash className="w-5 h-5 text-zinc-500 shrink-0" />
                  <span className="text-sm font-semibold text-white truncate">{activeChannel.name}</span>
                </>
              ) : activeFriend ? (
                <>
                  <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-300 shrink-0">
                    {initials(activeFriend.profile.username ?? activeFriend.profile.email)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{activeFriend.profile.username ?? activeFriend.profile.email}</p>
                    <p className="text-[11px] text-zinc-500">{activeFriend.profile.email}</p>
                  </div>
                </>
              ) : null}
            </div>

            {/* Messages */}
            <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 bg-zinc-950/40">
              <div className="max-w-3xl mx-auto space-y-1">
                {loadingCurrent ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                  </div>
                ) : currentMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <MessageSquare className="w-10 h-10 text-zinc-800 mb-4" strokeWidth={1.5} />
                    <p className="text-sm text-zinc-400">
                      {viewMode === 'servers' ? 'No messages in this channel yet' : 'No messages yet'}
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">Send a message below to start the conversation.</p>
                  </div>
                ) : (
                  currentMessages.map((group) => (
                    <div key={group.day} className="space-y-1">
                      <div className="flex items-center justify-center py-3">
                        <span className="text-[10px] font-medium text-zinc-500 bg-zinc-800/60 px-3 py-1 rounded-full uppercase tracking-wider">
                          {group.label}
                        </span>
                      </div>
                      {group.items.map((msg) => {
                        const mine = viewMode === 'servers'
                          ? isMe((msg as ServerMessage).user_id)
                          : isMe((msg as DirectMessage).sender_id);
                        const content = (msg as { content: string }).content;
                        return (
                          <div key={(msg as { id: string }).id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                              <div className={`px-3.5 py-2 text-sm leading-relaxed break-words ${
                                mine ? 'bg-blue-600 text-white rounded-2xl rounded-br-md' : 'bg-zinc-800 text-zinc-100 rounded-2xl rounded-bl-md'
                              }`}>
                                <p className="whitespace-pre-wrap">{content}</p>
                              </div>
                              <span className="text-[10px] text-zinc-600 mt-0.5 px-1">
                                {formatTime((msg as { created_at: string }).created_at)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="shrink-0 border-t border-zinc-800 bg-zinc-900/40 p-3">
              {error && (
                <div className="max-w-3xl mx-auto mb-2 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-xs text-red-400">{error}</span>
                </div>
              )}
              <div className="max-w-3xl mx-auto flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={
                    viewMode === 'servers' && activeChannel
                      ? `Message #${activeChannel.name}`
                      : viewMode === 'dms' && activeFriend
                      ? `Message ${activeFriend.profile.username ?? activeFriend.profile.email}...`
                      : 'Type a message...'
                  }
                  disabled={sending}
                  rows={1}
                  className="flex-1 resize-none bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors max-h-32"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white transition-colors"
                  aria-label="Send message"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <MessageSquare className="w-12 h-12 text-zinc-800 mb-4" strokeWidth={1.5} />
            {viewMode === 'servers' ? (
              <>
                <p className="text-sm text-zinc-400">
                  {joinedServers.length === 0 ? 'No servers yet' : 'Select a server'}
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  {joinedServers.length === 0 ? 'Click + in the server bar to create or join one.' : 'Pick a server from the left, then choose a channel.'}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-zinc-400">Select a friend to start chatting</p>
                <p className="text-xs text-zinc-600 mt-1">Add friends with the + button in the sidebar.</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ===== Create / Join Server modal ===== */}
      {showCreateServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowCreateServer(false)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-white">Create or Join a Server</h3>
              <button onClick={() => setShowCreateServer(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Create section */}
            <div className="mb-5">
              <p className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Create a new server</p>
              <div className="flex items-center gap-2">
                <input
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createServer()}
                  placeholder="Server name..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  onClick={createServer}
                  disabled={!newServerName.trim() || creatingServer}
                  className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg transition-colors"
                >
                  {creatingServer ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                </button>
              </div>
            </div>

            {/* Join by invite code */}
            <div className="mb-5">
              <p className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Join with invite code</p>
              <InviteCodeJoin onJoin={joinByInviteCode} />
            </div>

            {/* Search servers */}
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Search public servers</p>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2">
                  <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <input
                    value={serverSearchQuery}
                    onChange={(e) => setServerSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchServers()}
                    placeholder="Search by name..."
                    className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={searchServers}
                  disabled={!serverSearchQuery.trim() || searchingServers}
                  className="px-3 py-2 text-sm font-medium text-white bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 rounded-lg transition-colors"
                >
                  {searchingServers ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Go'}
                </button>
              </div>
              {serverSearchResults.length > 0 && (
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {serverSearchResults.map((s) => {
                    const isMember = joinedServers.some((js) => js.id === s.id);
                    return (
                      <li key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800">
                        <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0">
                          {s.name.slice(0, 1).toUpperCase()}
                        </div>
                        <span className="text-sm text-zinc-200 truncate flex-1">{s.name}</span>
                        <button
                          onClick={() => joinServer(s)}
                          disabled={isMember}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg transition-colors shrink-0"
                        >
                          {isMember ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          {isMember ? 'Joined' : 'Join'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {serverSearchQuery.trim() && !searchingServers && serverSearchResults.length === 0 && (
                <p className="text-xs text-zinc-600 text-center py-3">No servers found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Create channel modal ===== */}
      {showCreateChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowCreateChannel(false)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-white mb-4">Create a channel</h3>
            <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 mb-4">
              <Hash className="w-4 h-4 text-zinc-500 shrink-0" />
              <input
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createChannel()}
                placeholder="channel-name"
                autoFocus
                className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreateChannel(false)} className="px-4 py-2 text-sm text-zinc-300 hover:text-white">Cancel</button>
              <button
                onClick={createChannel}
                disabled={!newChannelName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Add friend modal ===== */}
      {showAddFriend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowAddFriend(false)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Add a friend</h3>
              <button onClick={() => setShowAddFriend(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input
                value={friendUsername}
                onChange={(e) => setFriendUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
                placeholder="Enter username..."
                autoFocus
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                onClick={handleSearchUser}
                disabled={!friendUsername.trim() || searching}
                className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg transition-colors"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {searchResults.length > 0 ? (
                <ul className="space-y-1">
                  {searchResults.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800">
                      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-300">
                        {initials(p.username ?? p.email)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{p.username ?? p.email}</p>
                        <p className="text-[11px] text-zinc-600 truncate">{p.email}</p>
                      </div>
                      <button
                        onClick={() => sendFriendRequest(p)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shrink-0"
                      >
                        <UserPlus className="w-3 h-3" />
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                friendUsername.trim() && !searching && (
                  <p className="text-xs text-zinc-600 text-center py-4">No users found. Try a different username.</p>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Friend requests modal ===== */}
      {showRequests && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowRequests(false)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">
                Friend Requests
                {pendingRequests.length > 0 && (
                  <span className="ml-2 text-xs text-red-400 font-normal">({pendingRequests.length} pending)</span>
                )}
              </h3>
              <button onClick={() => setShowRequests(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-8">No pending requests.</p>
            ) : (
              <ul className="space-y-2">
                {pendingRequests.map((req) => (
                  <li key={req.id} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/60">
                    <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-300">
                      {initials(req.profile.username ?? req.profile.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{req.profile.username ?? req.profile.email}</p>
                      <p className="text-[11px] text-zinc-600 truncate">{req.profile.email}</p>
                    </div>
                    <button
                      onClick={() => acceptRequest(req.id, req.profile)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shrink-0"
                    >
                      <Check className="w-3 h-3" />
                      Accept
                    </button>
                    <button
                      onClick={() => declineRequest(req.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                      aria-label="Decline"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Invite code join component =====
function InviteCodeJoin({ onJoin }: { onJoin: (code: string) => void }) {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  async function handleJoin() {
    if (!code.trim()) return;
    setJoining(true);
    await onJoin(code.trim());
    setJoining(false);
    setCode('');
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2">
        <Copy className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          placeholder="Enter invite code..."
          className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
        />
      </div>
      <button
        onClick={handleJoin}
        disabled={!code.trim() || joining}
        className="px-3 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg transition-colors"
      >
        {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
      </button>
    </div>
  );
}
