import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Plus, Trash2, Pencil, Eye, Columns2, Loader2, AlertCircle, FileText, Check,
  Search, X, ChevronDown, FolderOpen, FileCode, Network, List, ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { VaultNote, Vault, SaveState } from '@/lib/types';
import { markdownToHtml } from '@/lib/markdown';

type ViewMode = 'edit' | 'preview' | 'split';
type LayoutMode = 'list' | 'graph';

const LANGUAGES = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'rust', label: 'Rust' },
];

export default function VaultPage() {
  const { user } = useAuth();
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [activeVaultId, setActiveVaultId] = useState<string | null>(null);
  const [notes, setNotes] = useState<VaultNote[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('list');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [noteToDelete, setNoteToDelete] = useState<VaultNote | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState('');
  const [vaultDropdownOpen, setVaultDropdownOpen] = useState(false);
  const [showNewVault, setShowNewVault] = useState(false);
  const [newVaultName, setNewVaultName] = useState('');
  const [showNewNote, setShowNewNote] = useState(false);
  const [newNoteType, setNewNoteType] = useState<'markdown' | 'code'>('markdown');
  const [newNoteLang, setNewNoteLang] = useState('typescript');

  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<{ id: string; title: string; content: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) ?? null,
    [notes, activeId]
  );

  const activeVault = useMemo(
    () => vaults.find((v) => v.id === activeVaultId) ?? null,
    [vaults, activeVaultId]
  );

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [notes, query]);

  const fetchVaults = useCallback(async () => {
    const { data, error } = await supabase.from('vaults').select('*').order('created_at', { ascending: true });
    if (error) {
      setLoadError('Could not load vaults.');
      return;
    }
    setVaults(data ?? []);
    if (data && data.length > 0 && !activeVaultId) {
      setActiveVaultId(data[0].id);
    }
  }, [activeVaultId]);

  const fetchNotes = useCallback(async () => {
    if (!activeVaultId) {
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('vault_notes')
      .select('*')
      .eq('vault_id', activeVaultId)
      .order('updated_at', { ascending: false });
    if (error) {
      setLoadError('Could not load your notes.');
    } else {
      setNotes(data ?? []);
    }
    setLoading(false);
  }, [activeVaultId]);

  useEffect(() => {
    fetchVaults();
  }, [fetchVaults]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  async function createVault() {
    const name = newVaultName.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from('vaults')
      .insert({ name })
      .select('*')
      .single();
    if (error || !data) {
      setLoadError('Could not create vault.');
      return;
    }
    setVaults((prev) => [...prev, data]);
    setActiveVaultId(data.id);
    setNewVaultName('');
    setShowNewVault(false);
  }

  async function createNote() {
    if (!activeVaultId) return;
    const { data, error } = await supabase
      .from('vault_notes')
      .insert({
        vault_id: activeVaultId,
        title: 'Untitled',
        content: '',
        file_type: newNoteType,
        language: newNoteType === 'code' ? newNoteLang : null,
      })
      .select()
      .single();
    if (error || !data) {
      setLoadError('Could not create the note.');
      return;
    }
    setNotes((prev) => [data, ...prev]);
    setActiveId(data.id);
    setViewMode('edit');
    setLayoutMode('list');
    setShowNewNote(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function persistSave(noteId: string, title: string, content: string) {
    setSaveState('saving');
    const { error } = await supabase
      .from('vault_notes')
      .update({ title, content })
      .eq('id', noteId);
    if (error) {
      setSaveState('error');
      return;
    }
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, title, content, updated_at: new Date().toISOString() } : n))
    );
    setSaveState('saved');
    window.setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000);
  }

  function handleEditorChange(title: string, content: string) {
    if (!activeNote) return;
    setNotes((prev) =>
      prev.map((n) => (n.id === activeNote.id ? { ...n, title, content } : n))
    );
    setSaveState('saving');
    pendingSaveRef.current = { id: activeNote.id, title, content };
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const pending = pendingSaveRef.current;
      if (pending) {
        persistSave(pending.id, pending.title, pending.content);
        pendingSaveRef.current = null;
      }
    }, 800);
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  async function confirmDelete() {
    if (!noteToDelete) return;
    setDeleting(true);
    const { error } = await supabase.from('vault_notes').delete().eq('id', noteToDelete.id);
    setDeleting(false);
    if (error) {
      setLoadError('Could not delete the note.');
      setNoteToDelete(null);
      return;
    }
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== noteToDelete.id);
      if (activeId === noteToDelete.id) setActiveId(next[0]?.id ?? null);
      return next;
    });
    setNoteToDelete(null);
  }

  // ===== Graph data =====
  const graphData = useMemo(() => {
    const nodes = notes.map((n) => ({
      id: n.id,
      label: n.title || 'Untitled',
      note: n,
    }));
    const noteTitles = new Map(notes.map((n) => [n.title.toLowerCase().trim(), n.id]));
    const links: { source: string; target: string }[] = [];
    const seen = new Set<string>();
    for (const n of notes) {
      const matches = n.content.matchAll(/\[\[([^\]]+)\]\]/g);
      for (const m of matches) {
        const targetTitle = m[1].trim().toLowerCase();
        const targetId = noteTitles.get(targetTitle);
        if (targetId && targetId !== n.id) {
          const key = `${n.id}->${targetId}`;
          if (!seen.has(key)) {
            seen.add(key);
            links.push({ source: n.id, target: targetId });
          }
        }
      }
    }
    return { nodes, links };
  }, [notes]);

  return (
    <div className="h-[calc(100vh-3.5rem)] md:h-screen flex">
      {/* Notes list sidebar */}
      <div className="w-full md:w-80 shrink-0 border-r border-zinc-800 bg-zinc-900/40 flex flex-col h-full">
        {/* Vault selector + new note */}
        <div className="border-b border-zinc-800 shrink-0">
          <div className="relative px-4 h-14 flex items-center justify-between">
            <button
              onClick={() => setVaultDropdownOpen((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-white hover:text-blue-400 transition-colors min-w-0"
            >
              <FolderOpen className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="truncate">{activeVault?.name ?? 'Select Vault'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            </button>
            <button
              onClick={() => setShowNewNote(true)}
              disabled={!activeVaultId}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          </div>

          {/* Vault dropdown */}
          {vaultDropdownOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setVaultDropdownOpen(false)} />
              <div className="absolute left-4 top-14 z-30 w-64 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1">
                {vaults.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setActiveVaultId(v.id);
                      setActiveId(null);
                      setVaultDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      v.id === activeVaultId ? 'bg-blue-600/15 text-blue-400' : 'text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{v.name}</span>
                  </button>
                ))}
                <div className="border-t border-zinc-800 my-1" />
                <button
                  onClick={() => {
                    setShowNewVault(true);
                    setVaultDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Vault
                </button>
              </div>
            </>
          )}

          {/* View toggle: list / graph */}
          <div className="flex items-center gap-1 px-4 py-2">
            <button
              onClick={() => setLayoutMode('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                layoutMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
            <button
              onClick={() => setLayoutMode('graph')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                layoutMode === 'graph' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              Graph
            </button>
          </div>
        </div>

        {/* Search (list mode only) */}
        {layoutMode === 'list' && (
          <div className="px-3 py-2.5 border-b border-zinc-800 shrink-0">
            <div className="flex items-center gap-2 bg-zinc-800/60 rounded-lg px-3 py-1.5 border border-zinc-800">
              <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes..."
                spellCheck={false}
                className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content area */}
        {layoutMode === 'graph' ? (
          <GraphView
            notes={notes}
            graphData={graphData}
            onSelectNote={(id) => {
              setActiveId(id);
              setLayoutMode('list');
            }}
          />
        ) : (
          <div className="flex-1 overflow-y-auto py-2">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
              </div>
            ) : loadError ? (
              <div className="flex items-start gap-2 m-3 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 text-xs text-red-400">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{loadError}</span>
              </div>
            ) : notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                <FileText className="w-10 h-10 text-zinc-700 mb-4" strokeWidth={1.5} />
                <p className="text-sm text-zinc-400">
                  {activeVaultId ? 'No notes in this vault.' : 'Select or create a vault.'}
                </p>
              </div>
            ) : filteredNotes.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center mt-8 px-6">No notes match "{query}".</p>
            ) : (
              <ul className="space-y-0.5 px-2">
                {filteredNotes.map((note) => {
                  const active = activeId === note.id;
                  const isCode = note.file_type === 'code';
                  return (
                    <li key={note.id}>
                      <button
                        onClick={() => setActiveId(note.id)}
                        className={`group w-full text-left px-3 py-2.5 rounded-lg border-l-2 transition-all ${
                          active
                            ? 'border-blue-500 bg-blue-600/10'
                            : 'border-transparent hover:border-zinc-600 hover:bg-zinc-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isCode ? (
                            <FileCode className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-blue-400' : 'text-zinc-600'}`} />
                          ) : (
                            <FileText className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-blue-400' : 'text-zinc-600'}`} />
                          )}
                          <p className={`text-sm font-medium truncate ${active ? 'text-blue-400' : 'text-zinc-200'}`}>
                            {note.title || 'Untitled'}
                          </p>
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-0.5 pl-5.5">
                          {isCode && note.language ? `${note.language} · ` : ''}
                          {new Date(note.updated_at).toLocaleDateString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Editor pane */}
      <div className="hidden md:flex flex-1 flex-col h-full min-w-0 bg-[#0b0b0f]">
        {activeNote ? (
          <NoteEditor
            key={activeNote.id}
            note={activeNote}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            saveState={saveState}
            textareaRef={textareaRef}
            onChange={handleEditorChange}
            onDelete={() => setNoteToDelete(activeNote)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <FileText className="w-12 h-12 text-zinc-800 mb-4" strokeWidth={1.5} />
            <p className="text-sm text-zinc-400">Select a note to begin</p>
          </div>
        )}
      </div>

      {/* Mobile editor */}
      {activeNote && (
        <div className="md:hidden fixed inset-0 top-14 bg-[#0b0b0f] z-20">
          <NoteEditor
            key={activeNote.id}
            note={activeNote}
            viewMode={viewMode === 'split' ? 'edit' : viewMode}
            onViewModeChange={(m) => setViewMode(m === 'split' ? 'edit' : m)}
            saveState={saveState}
            textareaRef={textareaRef}
            onChange={handleEditorChange}
            onDelete={() => setNoteToDelete(activeNote)}
            onClose={() => setActiveId(null)}
          />
        </div>
      )}

      {/* Delete modal */}
      {noteToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => !deleting && setNoteToDelete(null)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Delete this note?</h3>
                <p className="text-xs text-zinc-500 mt-1">"{noteToDelete.title || 'Untitled'}" will be permanently deleted.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setNoteToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-zinc-300 hover:text-white bg-zinc-800 border border-zinc-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-60"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New vault modal */}
      {showNewVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowNewVault(false)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-white mb-4">Create a new vault</h3>
            <input
              value={newVaultName}
              onChange={(e) => setNewVaultName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createVault()}
              placeholder="Vault name"
              autoFocus
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNewVault(false)} className="px-4 py-2 text-sm text-zinc-300 hover:text-white">Cancel</button>
              <button
                onClick={createVault}
                disabled={!newVaultName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New note modal */}
      {showNewNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowNewNote(false)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-white mb-4">Create a new note</h3>
            <div className="mb-4">
              <p className="text-xs text-zinc-500 mb-2">Note type</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setNewNoteType('markdown')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    newNoteType === 'markdown' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Markdown
                </button>
                <button
                  onClick={() => setNewNoteType('code')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    newNoteType === 'code' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <FileCode className="w-4 h-4" />
                  Code
                </button>
              </div>
            </div>
            {newNoteType === 'code' && (
              <div className="mb-4">
                <p className="text-xs text-zinc-500 mb-2">Language</p>
                <select
                  value={newNoteLang}
                  onChange={(e) => setNewNoteLang(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNewNote(false)} className="px-4 py-2 text-sm text-zinc-300 hover:text-white">Cancel</button>
              <button
                onClick={createNote}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Graph View =====
function GraphView({
  notes,
  graphData,
  onSelectNote,
}: {
  notes: VaultNote[];
  graphData: { nodes: { id: string; label: string; note: VaultNote }[]; links: { source: string; target: string }[] };
  onSelectNote: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphLib, setGraphLib] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('react-force-graph-2d')
      .then((mod) => {
        if (!cancelled) setGraphLib(mod.default || mod);
      })
      .catch(() => {
        if (!cancelled) setError('Graph view requires a desktop browser to render.');
      });
    return () => { cancelled = true; };
  }, []);

  if (notes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <Network className="w-10 h-10 text-zinc-700 mb-3" strokeWidth={1.5} />
        <p className="text-sm text-zinc-400">No notes to graph yet</p>
        <p className="text-xs text-zinc-600 mt-1">Create notes and link them with [[Note Title]].</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <AlertCircle className="w-8 h-8 text-amber-500 mb-3" />
        <p className="text-sm text-zinc-400">{error}</p>
      </div>
    );
  }

  if (!graphLib) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
      </div>
    );
  }

  const ForceGraph = graphLib;

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden bg-zinc-950">
      <ForceGraph
        graphData={graphData}
        nodeLabel="label"
        nodeColor={(node: any) => (node.note?.file_type === 'code' ? '#f59e0b' : '#3b82f6')}
        nodeRelSize={6}
        linkColor={() => '#3f3f46'}
        linkDirectionalArrowLength={4}
        onNodeClick={(node: any) => onSelectNote(node.id)}
        backgroundColor="#09090b"
        height={containerRef.current?.clientHeight || 400}
      />
      <div className="absolute bottom-3 left-3 flex items-center gap-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Markdown</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Code</span>
      </div>
    </div>
  );
}

// ===== Note Editor =====
interface NoteEditorProps {
  note: VaultNote;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  saveState: SaveState;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onChange: (title: string, content: string) => void;
  onDelete: () => void;
  onClose?: () => void;
}

function NoteEditor({ note, viewMode, onViewModeChange, saveState, textareaRef, onChange, onDelete, onClose }: NoteEditorProps) {
  const previewHtml = useMemo(() => markdownToHtml(note.content), [note.content]);
  const isCode = note.file_type === 'code';

  const viewOptions: { mode: ViewMode; icon: typeof Pencil; label: string }[] = isCode
    ? [{ mode: 'edit', icon: Pencil, label: 'EDIT' }]
    : [
        { mode: 'edit', icon: Pencil, label: 'EDIT' },
        { mode: 'split', icon: Columns2, label: 'SPLIT' },
        { mode: 'preview', icon: Eye, label: 'VIEW' },
      ];

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 h-14 border-b border-zinc-800 bg-zinc-900/40 shrink-0">
        {onClose && (
          <button onClick={onClose} className="text-sm text-blue-400 hover:text-white transition-colors shrink-0 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}
        <div className="flex items-center gap-0.5 p-0.5 bg-zinc-800/60 rounded-md border border-zinc-800">
          {viewOptions.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-all ${
                viewMode === mode ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <SaveIndicator state={saveState} />
          <button
            onClick={onDelete}
            className="p-2 -mr-2 text-zinc-600 hover:text-red-400 transition-colors"
            aria-label="Delete note"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className={`flex-1 flex min-h-0 ${viewMode === 'split' ? 'divide-x divide-zinc-800' : ''}`}>
        {viewMode !== 'preview' && (
          <div className={`flex flex-col min-w-0 ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <div className="flex items-center gap-2 px-5 pt-4 pb-2">
              {isCode && (
                <FileCode className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              <input
                value={note.title}
                onChange={(e) => onChange(e.target.value, note.content)}
                placeholder="Untitled"
                spellCheck={false}
                className="flex-1 bg-transparent text-sm font-semibold text-white placeholder-zinc-600 focus:outline-none"
              />
              {isCode && note.language && (
                <span className="text-[10px] text-zinc-600 font-mono bg-zinc-800 px-2 py-0.5 rounded">
                  {note.language}
                </span>
              )}
            </div>
            <div className="h-px bg-zinc-800 mx-5" />
            {isCode ? (
              <textarea
                ref={textareaRef}
                value={note.content}
                onChange={(e) => onChange(note.title, e.target.value)}
                placeholder="// start coding..."
                spellCheck={false}
                className="flex-1 w-full resize-none bg-transparent px-5 py-4 font-mono text-[13px] text-zinc-300 leading-[1.7] placeholder-zinc-700 focus:outline-none"
              />
            ) : (
              <textarea
                ref={textareaRef}
                value={note.content}
                onChange={(e) => onChange(note.title, e.target.value)}
                placeholder="Start writing... markdown supported. Use [[Note Title]] to link notes."
                spellCheck={false}
                className="flex-1 w-full resize-none bg-transparent px-5 py-4 font-mono text-[13px] text-zinc-300 leading-[1.7] placeholder-zinc-700 focus:outline-none"
              />
            )}
          </div>
        )}
        {viewMode !== 'edit' && !isCode && (
          <div className={`flex-1 min-w-0 overflow-y-auto px-5 py-5 ${viewMode === 'split' ? 'w-1/2 bg-zinc-900/30' : ''}`}>
            {note.content.trim() ? (
              <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <p className="text-xs text-zinc-600">Nothing to render yet.</p>
            )}
          </div>
        )}
        {isCode && note.content.trim() && (
          <div className="flex-1 min-w-0 overflow-auto bg-zinc-950">
            <SyntaxHighlighter
              language={note.language || 'typescript'}
              style={oneDark}
              customStyle={{
                margin: 0,
                background: 'transparent',
                padding: '1rem 1.25rem',
                fontSize: '13px',
                lineHeight: '1.7',
              }}
            >
              {note.content}
            </SyntaxHighlighter>
          </div>
        )}
      </div>
    </>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
        <Loader2 className="w-3 h-3 animate-spin" /> Saving...
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
        <Check className="w-3 h-3" /> Saved
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-red-400">
        <AlertCircle className="w-3 h-3" /> Save failed
      </span>
    );
  }
  return null;
}
