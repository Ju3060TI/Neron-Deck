import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Trash2, Users, Settings, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { displayNameOf } from '@/lib/types';
import type { Server, Profile } from '@/lib/types';
import UserAvatar from '@/components/ui/UserAvatar';

interface ServerSettingsModalProps {
  server: Server;
  onClose: () => void;
  onRenamed: (newName: string) => void;
  onDeleted: () => void;
}

type Tab = 'overview' | 'members' | 'delete';

export default function ServerSettingsModal({ server, onClose, onRenamed, onDeleted }: ServerSettingsModalProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [name, setName] = useState(server.name);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<{ profile: Profile; isOwner: boolean }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    const { data: memberships } = await supabase
      .from('server_members')
      .select('user_id')
      .eq('server_id', server.id);
    const memberIds = (memberships ?? []).map((m) => m.user_id);
    const ownerProfile = await supabase
      .from('profiles')
      .select('*')
      .eq('id', server.owner_id)
      .maybeSingle();
    const { data: memberProfiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', memberIds);
    const allProfiles = [...(memberProfiles ?? []), ...(ownerProfile.data ? [ownerProfile.data] : [])];
    const deduped = Array.from(new Map(allProfiles.map((p) => [p.id, p as Profile])).values());
    setMembers(deduped.map((p) => ({ profile: p, isOwner: p.id === server.owner_id })));
    setLoadingMembers(false);
  }, [server.id, server.owner_id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  async function handleRename() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === server.name) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('servers')
      .update({ name: trimmed })
      .eq('id', server.id);
    if (err) {
      setError('Server konnte nicht umbenannt werden.');
    } else {
      onRenamed(trimmed);
    }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const { error: err } = await supabase
      .from('servers')
      .delete()
      .eq('id', server.id);
    if (err) {
      setError('Server konnte nicht gelöscht werden.');
      setDeleting(false);
      return;
    }
    onDeleted();
  }

  const tabs: { key: Tab; label: string; icon: typeof Settings }[] = [
    { key: 'overview', label: 'Übersicht', icon: Settings },
    { key: 'members', label: 'Mitglieder', icon: Users },
    { key: 'delete', label: 'Löschen', icon: Trash2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#36393f] rounded-xl w-full max-w-2xl h-[520px] flex overflow-hidden shadow-2xl">
        {/* Tab sidebar */}
        <div className="w-44 bg-[#2f3136] flex flex-col py-3 shrink-0">
          <h2 className="px-3 pb-2 text-xs font-bold text-white uppercase tracking-wider">Servereinstellungen</h2>
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-3 py-2 mx-1 rounded text-sm transition-colors ${
                tab === key
                  ? key === 'delete'
                    ? 'bg-red-600/20 text-red-400'
                    : 'bg-[#42464d] text-white'
                  : 'text-[#b9bbbe] hover:bg-[#393c43] hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#202225] shrink-0">
            <h3 className="text-sm font-semibold text-white">
              {tab === 'overview' ? 'Übersicht' : tab === 'members' ? 'Mitglieder' : 'Server löschen'}
            </h3>
            <button onClick={onClose} className="text-[#b9bbbe] hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {error && (
              <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-xs text-red-400">{error}</span>
              </div>
            )}

            {tab === 'overview' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-[#b9bbbe] uppercase tracking-wider mb-2">
                    Servername
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                    className="w-full bg-[#202225] border border-[#202225] rounded px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
                <button
                  onClick={handleRename}
                  disabled={!name.trim() || name.trim() === server.name || saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-40 rounded transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Speichern'}
                </button>
              </div>
            )}

            {tab === 'members' && (
              <div>
                {loadingMembers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 text-[#72767d] animate-spin" />
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {members.map(({ profile, isOwner }) => (
                      <li key={profile.id} className="flex items-center gap-3 p-2 rounded hover:bg-[#393c43] transition-colors">
                        <UserAvatar name={displayNameOf(profile)} avatarUrl={profile.avatar_url} className="w-8 h-8 text-xs shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">{displayNameOf(profile)}</p>
                          <p className="text-[11px] text-[#72767d] truncate">{profile.email}</p>
                        </div>
                        {isOwner && (
                          <span className="text-[10px] font-semibold text-[#faa61a] bg-[#faa61a]/10 px-2 py-0.5 rounded">Eigentümer</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === 'delete' && (
              <div className="space-y-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4">
                  <p className="text-sm text-red-400 font-semibold mb-1">Server löschen</p>
                  <p className="text-xs text-[#b9bbbe]">
                    Diese Aktion kann nicht rückgängig gemacht werden. Alle Kanäle, Nachrichten und Mitglieder werden permanent entfernt.
                  </p>
                </div>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Server löschen
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-white">Gib den Servernamen zur Bestätigung ein:</p>
                    <p className="text-xs text-[#b9bbbe]">Tippe <span className="font-bold text-white">{server.name}</span> ein:</p>
                    <input
                      onChange={(e) => {
                        if (e.target.value === server.name) handleDelete();
                      }}
                      placeholder={server.name}
                      className="w-full bg-[#202225] border border-red-500/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                      autoFocus
                    />
                    {deleting && (
                      <div className="flex items-center gap-2 text-sm text-[#b9bbbe]">
                        <Loader2 className="w-4 h-4 animate-spin" /> Wird gelöscht…
                      </div>
                    )}
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-4 py-2 text-sm text-[#b9bbbe] hover:text-white"
                    >
                      Abbrechen
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
