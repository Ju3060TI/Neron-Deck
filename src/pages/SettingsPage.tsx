import { useState } from 'react';
import { Eye, EyeOff, Check, Cloud, Loader2, Bot, CloudOff } from 'lucide-react';
import { GROQ_KEY_STORAGE } from '@/lib/types';

export default function SettingsPage() {
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
