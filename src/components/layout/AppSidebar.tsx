import { useState } from 'react';
import {
  ChevronDown, ChevronRight, Hash, Volume2, Plus, MoreHorizontal,
  Pencil, Trash2, MessageSquare, PlusCircle,
} from 'lucide-react';
import UserAvatar from '@/components/ui/UserAvatar';
import { displayNameOf } from '@/lib/types';
import type { Server, Channel, ChannelCategory, Profile } from '@/lib/types';

interface AppSidebarProps {
  // Server rail (left icon column)
  joinedServers: Server[];
  activeServerId: string | null;
  onSelectServer: (server: Server) => void;
  onOpenCreateServer: () => void;

  // DMs
  friends: { id: string; profile: Profile }[];
  activeFriendId: string | null;
  onSelectDM: (friendId: string) => void;
  onOpenDMActions: () => void;

  // Channels for the active server
  channels: Channel[];
  categories: ChannelCategory[];
  loadingChannels: boolean;
  activeChannelId: string | null;
  activeVoiceChannelId: string | null;
  onSelectTextChannel: (channel: Channel) => void;
  onSelectVoiceChannel: (channel: Channel) => void;

  // Owner actions
  isOwner: boolean;
  onCreateChannel: (name: string, type: 'text' | 'voice', categoryId: string | null) => void;
  onCreateCategory: (name: string) => void;
  onRenameCategory: (categoryId: string, name: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onMoveChannelToCategory: (channelId: string, categoryId: string | null) => void;
}

interface CategoryMenuState {
  categoryId: string;
  x: number;
  y: number;
}

interface MoveMenuState {
  channelId: string;
  x: number;
  y: number;
}

export default function AppSidebar({
  joinedServers,
  activeServerId,
  onSelectServer,
  onOpenCreateServer,
  friends,
  activeFriendId,
  onSelectDM,
  onOpenDMActions,
  channels,
  categories,
  loadingChannels,
  activeChannelId,
  activeVoiceChannelId,
  onSelectTextChannel,
  onSelectVoiceChannel,
  isOwner,
  onCreateChannel,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onMoveChannelToCategory,
}: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newChannelState, setNewChannelState] = useState<{ categoryId: string | null; name: string; type: 'text' | 'voice' } | null>(null);
  const [categoryMenu, setCategoryMenu] = useState<CategoryMenuState | null>(null);
  const [moveMenu, setMoveMenu] = useState<MoveMenuState | null>(null);

  const toggleCollapsed = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCategoryMenu = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMoveMenu(null);
    setCategoryMenu({ categoryId, x: rect.left, y: rect.bottom + 4 });
  };

  const openMoveMenu = (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCategoryMenu(null);
    setMoveMenu({ channelId, x: rect.left, y: rect.bottom + 4 });
  };

  const submitNewCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    onCreateCategory(name);
    setNewCategoryName('');
    setShowNewCategory(false);
  };

  const submitRename = () => {
    const name = renameValue.trim();
    if (!name || !renamingId) return;
    onRenameCategory(renamingId, name);
    setRenamingId(null);
  };

  const submitNewChannel = () => {
    if (!newChannelState || !newChannelState.name.trim()) return;
    onCreateChannel(newChannelState.name.trim(), newChannelState.type, newChannelState.categoryId);
    setNewChannelState(null);
  };

  const sortedCategories = [...categories].sort((a, b) => a.position - b.position);
  const uncategorized = channels.filter((c) => !c.category_id);

  const renderChannel = (ch: Channel) => {
    const isText = ch.type === 'text';
    const active = activeChannelId === ch.id;
    const inVoice = activeVoiceChannelId === ch.id;
    return (
      <li key={ch.id}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => (isText ? onSelectTextChannel(ch) : onSelectVoiceChannel(ch))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (isText ? onSelectTextChannel(ch) : onSelectVoiceChannel(ch));
          }}
          className={`group w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
            active || inVoice
              ? 'bg-[#393c43] text-white'
              : 'text-[#b9bbbe] hover:bg-[#393c43] hover:text-[#dcddde]'
          }`}
        >
          {isText
            ? <Hash className="w-4 h-4 text-[#72767d] shrink-0" />
            : <Volume2 className="w-4 h-4 text-[#72767d] shrink-0" />}
          <span className="truncate">{ch.name}</span>
          {isOwner && (
            <button
              onClick={(e) => openMoveMenu(ch.id, e)}
              className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 text-[#72767d] hover:text-white transition-opacity"
              title="In Kategorie verschieben"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="flex h-full shrink-0">
      {/* ===== Server rail ===== */}
      <div className="w-[72px] bg-[#202225] flex flex-col items-center py-3 gap-2 overflow-y-auto shrink-0">
        <button
          onClick={onOpenDMActions}
          className={`w-12 h-12 rounded-[24px] flex items-center justify-center transition-all duration-200 ${
            activeServerId === null
              ? 'bg-[#5865f2] rounded-[16px] text-white'
              : 'bg-[#36393f] text-[#b9bbbe] hover:bg-[#5865f2] hover:rounded-[16px] hover:text-white'
          }`}
          title="Direktnachrichten"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
        <div className="w-8 h-0.5 bg-[#36393f] rounded-full my-1" />
        {joinedServers.map((server) => {
          const active = activeServerId === server.id;
          return (
            <button
              key={server.id}
              onClick={() => onSelectServer(server)}
              className={`relative w-12 h-12 rounded-[24px] flex items-center justify-center text-sm font-bold transition-all duration-200 shrink-0 ${
                active
                  ? 'bg-[#5865f2] rounded-[16px] text-white'
                  : 'bg-[#36393f] text-[#b9bbbe] hover:bg-[#5865f2] hover:rounded-[16px] hover:text-white'
              }`}
              title={server.name}
            >
              {server.name.slice(0, 1).toUpperCase()}
              <span className={`absolute -left-3 top-1/2 -translate-y-1/2 w-1 rounded-r-full transition-all ${active ? 'h-8 bg-white' : 'h-2 bg-[#72767d]'}`} />
            </button>
          );
        })}
        <button
          onClick={onOpenCreateServer}
          className="w-12 h-12 rounded-[24px] flex items-center justify-center bg-[#36393f] text-[#3ba55d] hover:bg-[#3ba55d] hover:rounded-[16px] hover:text-white transition-all duration-200 shrink-0"
          title="Server erstellen oder beitreten"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* ===== Channel / DM panel ===== */}
      <div className="w-60 bg-[#2f3136] flex flex-col h-full overflow-hidden">
        {activeServerId === null ? (
          /* ---------- DM list ---------- */
          <>
            <div className="flex items-center justify-between px-4 h-12 border-b border-[#202225] shrink-0">
              <h2 className="text-sm font-semibold text-white">Direktnachrichten</h2>
              <button
                onClick={onOpenDMActions}
                className="p-1 text-[#b9bbbe] hover:text-white hover:bg-[#393c43] rounded transition-colors"
                title="Aktionen"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2 px-2">
              {friends.length === 0 ? (
                <p className="text-xs text-[#72767d] text-center py-8 px-4">Noch keine Freunde. Füge Freunde hinzu, um zu chatten.</p>
              ) : (
                <ul className="space-y-0.5">
                  {friends.map((f) => {
                    const active = activeFriendId === f.profile.id;
                    const name = displayNameOf(f.profile);
                    return (
                      <li key={f.id}>
                        <button
                          onClick={() => onSelectDM(f.profile.id)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                            active
                              ? 'bg-[#393c43] text-white'
                              : 'text-[#b9bbbe] hover:bg-[#393c43] hover:text-[#dcddde]'
                          }`}
                        >
                          <UserAvatar name={name} avatarUrl={f.profile.avatar_url} className="w-8 h-8 text-xs shrink-0" />
                          <span className="truncate">{name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        ) : (
          /* ---------- Channel list with categories ---------- */
          <>
            <div className="flex items-center px-4 h-12 border-b border-[#202225] shadow-sm shrink-0">
              <h2 className="text-sm font-semibold text-white truncate">
                {joinedServers.find((s) => s.id === activeServerId)?.name ?? ''}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto py-2 px-2">
              {loadingChannels ? (
                <p className="text-xs text-[#72767d] text-center py-8">Lade Kanäle…</p>
              ) : (
                <>
                  {isOwner && (
                    <button
                      onClick={() => setShowNewCategory(true)}
                      className="w-full flex items-center gap-1.5 px-2.5 py-1 mb-1 text-[11px] font-semibold text-[#72767d] hover:text-[#dcddde] uppercase tracking-wider rounded hover:bg-[#393c43] transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Kategorie erstellen
                    </button>
                  )}
                  {showNewCategory && (
                    <div className="mb-2 px-1">
                      <input
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitNewCategory();
                          if (e.key === 'Escape') setShowNewCategory(false);
                        }}
                        onBlur={submitNewCategory}
                        autoFocus
                        placeholder="Neue Kategorie…"
                        className="w-full bg-[#202225] border border-[#36393f] rounded px-2 py-1.5 text-xs text-white placeholder-[#72767d] focus:outline-none focus:border-[#5865f2]"
                      />
                    </div>
                  )}

                  {/* Categories */}
                  {sortedCategories.map((cat) => {
                    const isCollapsed = collapsed.has(cat.id);
                    const catChannels = channels.filter((c) => c.category_id === cat.id);
                    return (
                      <div key={cat.id} className="mb-3">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleCollapsed(cat.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') toggleCollapsed(cat.id); }}
                          className="group flex items-center gap-1 px-1 py-1 cursor-pointer select-none rounded hover:bg-[#393c43] transition-colors"
                        >
                          {isCollapsed
                            ? <ChevronRight className="w-3 h-3 text-[#72767d] shrink-0" />
                            : <ChevronDown className="w-3 h-3 text-[#72767d] shrink-0" />}
                          {renamingId === cat.id ? (
                            <input
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') submitRename();
                                if (e.key === 'Escape') setRenamingId(null);
                              }}
                              onBlur={submitRename}
                              autoFocus
                              className="flex-1 bg-[#202225] border border-[#36393f] rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white focus:outline-none focus:border-[#5865f2]"
                            />
                          ) : (
                            <span className="flex-1 text-[11px] font-semibold text-[#72767d] uppercase tracking-wider truncate group-hover:text-[#dcddde] transition-colors">
                              {cat.name}
                            </span>
                          )}
                          {isOwner && renamingId !== cat.id && (
                            <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); setNewChannelState({ categoryId: cat.id, name: '', type: 'text' }); }}
                                className="p-0.5 text-[#72767d] hover:text-white"
                                title="Kanal hinzufügen"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => openCategoryMenu(cat.id, e)}
                                className="p-0.5 text-[#72767d] hover:text-white"
                                title="Kategorie-Optionen"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          )}
                        </div>
                        {!isCollapsed && (
                          <ul className="space-y-0.5 mt-0.5">
                            {catChannels.map(renderChannel)}
                            {catChannels.length === 0 && (
                              <li className="px-2.5 py-1 text-[11px] text-[#72767d] italic">Keine Kanäle</li>
                            )}
                          </ul>
                        )}
                      </div>
                    );
                  })}

                  {/* Uncategorized channels */}
                  {uncategorized.length > 0 && (
                    <div className="mb-3">
                      <div className="px-1 py-1 text-[11px] font-semibold text-[#72767d] uppercase tracking-wider">
                        Kanäle
                      </div>
                      <ul className="space-y-0.5">{uncategorized.map(renderChannel)}</ul>
                    </div>
                  )}

                  {/* New channel inline input */}
                  {newChannelState && (
                    <div className="mt-1 px-1">
                      <div className="flex items-center gap-1.5 bg-[#202225] border border-[#36393f] rounded px-2 py-1">
                        {newChannelState.type === 'text'
                          ? <Hash className="w-3.5 h-3.5 text-[#72767d]" />
                          : <Volume2 className="w-3.5 h-3.5 text-[#72767d]" />}
                        <input
                          value={newChannelState.name}
                          onChange={(e) => setNewChannelState({ ...newChannelState, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitNewChannel();
                            if (e.key === 'Escape') setNewChannelState(null);
                          }}
                          onBlur={submitNewChannel}
                          autoFocus
                          placeholder="neuer-kanal"
                          className="flex-1 bg-transparent text-xs text-white placeholder-[#72767d] focus:outline-none min-w-0"
                        />
                        <button
                          onClick={() => setNewChannelState({ ...newChannelState, type: newChannelState.type === 'text' ? 'voice' : 'text' })}
                          className="text-[10px] text-[#b9bbbe] hover:text-white shrink-0"
                          title="Typ wechseln"
                        >
                          {newChannelState.type === 'text' ? '→ Voice' : '→ Text'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ===== Category context menu (rename / delete) ===== */}
      {categoryMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCategoryMenu(null)} />
          <div
            className="fixed z-50 w-40 bg-[#18191c] rounded-md shadow-xl border border-[#202225] py-1.5"
            style={{ left: Math.min(categoryMenu.x, window.innerWidth - 176), top: categoryMenu.y }}
          >
            <button
              onClick={() => {
                const cat = categories.find((c) => c.id === categoryMenu.categoryId);
                setRenameValue(cat?.name ?? '');
                setRenamingId(categoryMenu.categoryId);
                setCategoryMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[#b9bbbe] hover:bg-[#5865f2] hover:text-white transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Umbenennen
            </button>
            <button
              onClick={() => {
                if (window.confirm('Kategorie wirklich löschen? Die Kanäle bleiben erhalten.')) {
                  onDeleteCategory(categoryMenu.categoryId);
                }
                setCategoryMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-red-600 hover:text-white transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Löschen
            </button>
          </div>
        </>
      )}

      {/* ===== Move channel to category menu ===== */}
      {moveMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMoveMenu(null)} />
          <div
            className="fixed z-50 w-48 max-h-56 overflow-y-auto bg-[#18191c] rounded-md shadow-xl border border-[#202225] py-1.5"
            style={{ left: Math.min(moveMenu.x, window.innerWidth - 208), top: moveMenu.y }}
          >
            <p className="px-3 py-1 text-[10px] font-semibold text-[#72767d] uppercase tracking-wider">Verschieben nach</p>
            <button
              onClick={() => { onMoveChannelToCategory(moveMenu.channelId, null); setMoveMenu(null); }}
              className="w-full px-3 py-1.5 text-left text-sm text-[#b9bbbe] hover:bg-[#5865f2] hover:text-white transition-colors"
            >
              Ohne Kategorie
            </button>
            {sortedCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { onMoveChannelToCategory(moveMenu.channelId, cat.id); setMoveMenu(null); }}
                className="w-full px-3 py-1.5 text-left text-sm text-[#b9bbbe] hover:bg-[#5865f2] hover:text-white transition-colors"
              >
                {cat.name}
              </button>
            ))}
            {sortedCategories.length === 0 && (
              <p className="px-3 py-1.5 text-xs text-[#72767d]">Keine Kategorien vorhanden</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
