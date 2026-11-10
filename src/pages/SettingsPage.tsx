import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Check, Cloud, Loader2, Bot, CloudOff, UserRound, ImagePlus } from 'lucide-react';
import { GROQ_KEY_STORAGE, USERNAME_PATTERN } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import UserAvatar from '@/components/UserAvatar';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export default function SettingsPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const [savedUsername, setSavedUsername] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameSaved, setUsernameSaved] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [keyInput, setKeyInput] = useState(() => {
    try {
      return sessionStorage.getItem(GROQ_KEY_STORAGE) ?? '';
    } catch {
      return '';
    }
  });
  const [visible, setVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const keyLoaded = keyInput.trim().length > 0;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setUsernameError('Profil konnte nicht geladen werden.');
        } else {
          const name = data?.username ?? '';
          setSavedUsername(name);
          setAvatarUrl(data?.avatar_url ?? null);
          setUsernameInput(name);
        }
        setLoadingProfile(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleUsernameSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const trimmed = usernameInput.trim();
    if (!USERNAME_PATTERN.test(trimmed)) {
      setUsernameError('Nutzername: 3 bis 20 Zeichen, nur Buchstaben, Zahlen und Unterstrich.');
      return;
    }

    setSavingUsername(true);
    setUsernameError(null);
    setUsernameSaved(false);
    const { data, error } = await supabase
      .from('profiles')
      .update({ username: trimmed })
      .eq('id', userId)
      .select('username')
      .maybeSingle();
    setSavingUsername(false);

    if (error) {
      setUsernameError(
        error.code === '23505'
          ? 'Dieser Nutzername ist bereits vergeben.'
          : 'Nutzername konnte nicht gespeichert werden.'
      );
      return;
    }
    if (!data) {
      setUsernameError('Nutzername konnte nicht gespeichert werden.');
      return;
    }
    setSavedUsername(trimmed);
    setUsernameInput(trimmed);
    setUsernameSaved(true);
    window.setTimeout(() => setUsernameSaved(false), 2000);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !userId) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Bitte wähle eine Bilddatei aus.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Das Bild darf höchstens 2 MB groß sein.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    setAvatarError(null);
    setUploadingAvatar(true);

    const path = `${userId}/${Date.now()}.${file.type.split('/')[1]}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { contentType: file.type, cacheControl: '3600' });
    if (uploadError) {
      URL.revokeObjectURL(previewUrl);
      setAvatarPreview(null);
      setAvatarError('Profilbild konnte nicht hochgeladen werden.');
      setUploadingAvatar(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: urlData.publicUrl })
      .eq('id', userId);
    if (updateError) {
      void supabase.storage.from('avatars').remove([path]);
      URL.revokeObjectURL(previewUrl);
      setAvatarPreview(null);
      setAvatarError('Profilbild konnte nicht gespeichert werden.');
      setUploadingAvatar(false);
      return;
    }

    const previousPath = avatarUrl?.split('/avatars/')[1];
    if (previousPath?.startsWith(`${userId}/`)) {
      void supabase.storage.from('avatars').remove([previousPath]);
    }
    URL.revokeObjectURL(previewUrl);
    setAvatarPreview(null);
    setAvatarUrl(urlData.publicUrl);
    setUploadingAvatar(false);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const trimmed = keyInput.trim();
      if (trimmed) {
        sessionStorage.setItem(GROQ_KEY_STORAGE, trimmed);
      } else {
        sessionStorage.removeItem(GROQ_KEY_STORAGE);
      }
      setKeyInput(trimmed);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto relative z-10">
      <div className="mb-8">
        <p className="sys-label mb-1">// SYSTEM CONFIGURATION</p>
        <h1 className="text-xl font-semibold text-white tracking-tight">Settings</h1>
      </div>

      {/* Profile */}
      <section className="glass-panel p-5 md:p-6 mb-6">
        <div className="flex items-center gap-3 mb-1">
          <UserRound className="w-4 h-4 text-accent drop-shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
          <h2 className="sys-label">// PROFIL</h2>
        </div>
        <p className="font-mono text-[11px] text-gray-500 leading-relaxed mb-6 mt-2">
          Unter diesem Namen finden dich Freunde in der Suche. Erlaubt sind 3 bis 20 Zeichen:
          Buchstaben, Zahlen und Unterstrich.
        </p>

        <div className="flex items-center gap-4 mb-6">
          <UserAvatar
            name={savedUsername || 'Unbenannt'}
            avatarUrl={avatarPreview ?? avatarUrl}
            className="w-14 h-14 text-sm"
          />
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[11px] text-gray-400">
              {savedUsername || 'Noch kein Nutzername gesetzt'}
            </p>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="mt-2 flex items-center gap-2 font-mono text-[10px] tracking-widest text-accent hover:text-accent-hover disabled:opacity-60 transition-colors"
            >
              {uploadingAvatar ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
              {uploadingAvatar ? 'LÄDT...' : 'PROFILBILD ÄNDERN'}
            </button>
            <p className="font-mono text-[10px] text-gray-600 mt-1">PNG, JPG, WEBP oder GIF, max. 2 MB</p>
            {avatarError && <p className="font-mono text-[11px] text-red-300 mt-1">{avatarError}</p>}
          </div>
        </div>

        <form onSubmit={handleUsernameSave} className="space-y-5">
          <div>
            <label htmlFor="username" className="font-mono text-[10px] tracking-widest text-gray-400 uppercase block mb-2">
              Nutzername
            </label>
            <div className="terminal-line">
              <span className="prompt select-none">&gt;</span>
              <input
                id="username"
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="commander_01"
                autoComplete="off"
                spellCheck={false}
                maxLength={20}
                disabled={loadingProfile}
              />
            </div>
          </div>

          {usernameError && (
            <p className="font-mono text-xs text-red-300 leading-relaxed">{usernameError}</p>
          )}

          <button
            type="submit"
            disabled={savingUsername || loadingProfile || usernameInput.trim() === savedUsername}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed text-white font-mono text-xs tracking-widest px-5 py-2.5 rounded-md transition-all shadow-[0_0_14px_rgba(59,130,246,0.35)] hover:shadow-[0_0_20px_rgba(59,130,246,0.55)]"
          >
            {savingUsername ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : usernameSaved ? (
              <Check className="w-3.5 h-3.5" />
            ) : null}
            {usernameSaved ? 'GESPEICHERT' : 'SPEICHERN'}
          </button>
        </form>
      </section>

      {/* AI Subsystems */}
      <section className="glass-panel p-5 md:p-6 mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Bot className="w-4 h-4 text-accent drop-shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
          <h2 className="sys-label">// AI SUBSYSTEMS</h2>
        </div>
        <p className="font-mono text-[11px] text-gray-500 leading-relaxed mb-6 mt-2">
          Groq API key is held in session storage only — never persisted to the database, never
          transmitted anywhere except api.groq.com.
        </p>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label htmlFor="groq-key" className="font-mono text-[10px] tracking-widest text-gray-400 uppercase block mb-2">
              GROQ_API_KEY
            </label>
            <div className="terminal-line">
              <span className="prompt select-none">&gt;</span>
              <input
                id="groq-key"
                type={visible ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="gsk_..."
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="text-gray-600 hover:text-gray-400 transition-colors shrink-0"
                aria-label={visible ? 'Hide key' : 'Show key'}
              >
                {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="font-mono text-[10px] text-gray-600">
                // free keys at console.groq.com — prefix "gsk_"
              </p>
              <p
                className={`font-mono text-[10px] tracking-widest ${
                  keyLoaded ? 'text-emerald-400' : 'text-gray-600'
                }`}
              >
                {keyLoaded ? '[ KEY LOADED ]' : '[ NO KEY ]'}
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-mono text-xs tracking-widest px-5 py-2.5 rounded-md transition-all shadow-[0_0_14px_rgba(59,130,246,0.35)] hover:shadow-[0_0_20px_rgba(59,130,246,0.55)]"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <Check className="w-3.5 h-3.5" />
            ) : null}
            {saved ? 'COMMITTED' : 'COMMIT KEY'}
          </button>
        </form>
      </section>

      {/* Cloud Uplink */}
      <section className="glass-panel p-5 md:p-6">
        <div className="flex items-center gap-3 mb-1">
          <Cloud className="w-4 h-4 text-gray-500" />
          <h2 className="sys-label text-gray-400" style={{ textShadow: 'none' }}>
            // CLOUD UPLINK
          </h2>
        </div>
        <p className="font-mono text-[11px] text-gray-500 leading-relaxed mb-6 mt-2">
          Mirror your Vault across devices with end-to-end encryption.
        </p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button
            disabled
            className="flex items-center gap-2 bg-white/5 border border-white/10 text-gray-500 font-mono text-xs tracking-widest px-5 py-2.5 rounded-md cursor-not-allowed"
          >
            <CloudOff className="w-3.5 h-3.5" />
            CONNECT CLOUDFLARE
          </button>
          <span className="font-mono text-[10px] tracking-widest text-amber-500/80 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80 animate-pulse" />
            MODULE OFFLINE — COMING SOON
          </span>
        </div>
      </section>
    </div>
  );
}
