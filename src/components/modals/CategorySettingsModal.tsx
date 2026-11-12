import { useState } from 'react';
import { X, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ChannelCategory } from '@/lib/types';

interface CategorySettingsModalProps {
  category: ChannelCategory;
  onClose: () => void;
  onRenamed: (newName: string) => void;
  onDeleted: () => void;
}

export default function CategorySettingsModal({ category, onClose, onRenamed, onDeleted }: CategorySettingsModalProps) {
  const [name, setName] = useState(category.name);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleRename() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === category.name) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('channel_categories')
      .update({ name: trimmed })
      .eq('id', category.id);
    if (err) {
      setError('Kategorie konnte nicht umbenannt werden.');
    } else {
      onRenamed(trimmed);
    }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const { error: err } = await supabase
      .from('channel_categories')
      .delete()
      .eq('id', category.id);
    if (err) {
      setError('Kategorie konnte nicht gelöscht werden.');
      setDeleting(false);
      return;
    }
    onDeleted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#36393f] rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#202225]">
          <h3 className="text-sm font-semibold text-white">Kategorie-Einstellungen</h3>
          <button onClick={onClose} className="text-[#b9bbbe] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-[#b9bbbe] uppercase tracking-wider mb-2">
              Kategoriename
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
              className="w-full bg-[#202225] border border-[#202225] rounded px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#5865f2]"
            />
          </div>

          <button
            onClick={handleRename}
            disabled={!name.trim() || name.trim() === category.name || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-40 rounded transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Speichern'}
          </button>

          <div className="pt-4 border-t border-[#202225]">
            <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">Gefahrenzone</p>
            <p className="text-xs text-[#b9bbbe] mb-3">
              Die Kanäle in dieser Kategorie bleiben erhalten, werden aber unkategorisiert.
            </p>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Kategorie löschen
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-white">Wirklich löschen?</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 rounded transition-colors"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Ja, löschen
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-4 py-2 text-sm text-[#b9bbbe] hover:text-white"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
