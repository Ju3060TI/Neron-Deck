import { useState } from 'react';
import { Loader2, Hexagon, AlertCircle, UserPlus, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function friendlyError(message: string): string {
    if (message.includes('Invalid login credentials')) return 'Incorrect email or password.';
    if (message.includes('already registered')) return 'This email already has an account. Try signing in.';
    if (message.includes('Password should be')) return 'Password must be at least 6 characters.';
    if (message.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
    if (message.includes('valid email')) return 'Please enter a valid email address.';
    return message;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
        if (err) throw err;
        if (data.session) {
          setNotice('Account created. Welcome aboard.');
        } else {
          setNotice('Account created. You can now sign in.');
          setMode('signin');
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
      }
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen auth-bg flex items-center justify-center px-4 relative">
      <div className="cockpit-bg" aria-hidden="true" />
      <div className="w-full max-w-sm animate-fade-in-up relative">
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <Hexagon
              className="w-12 h-12 text-accent drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]"
              strokeWidth={1.5}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
            </div>
          </div>
          <h1 className="holo-text text-xl font-bold tracking-[0.2em] uppercase animate-flicker">
            Neron-Deck
          </h1>
          <p className="font-mono text-[10px] text-gray-500 mt-2 tracking-[0.25em] uppercase flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_4px_1px_rgba(52,211,153,0.7)]" />
            Command Center
          </p>
        </div>

        <div className="glass-panel p-6">
          <div className="flex gap-0.5 p-0.5 bg-space/80 rounded-md mb-6 border border-white/10">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setNotice(null);
                }}
                className={`flex-1 py-2 font-mono text-[11px] tracking-widest uppercase rounded transition-all ${
                  mode === m
                    ? 'bg-accent-soft text-accent shadow-[inset_0_0_10px_rgba(59,130,246,0.2)]'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {m === 'signin' ? 'AUTHENTICATE' : 'ENROLL'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="font-mono text-[10px] tracking-widest text-gray-400 uppercase block mb-2">
                Operator ID
              </label>
              <div className="terminal-line">
                <span className="prompt select-none">&gt;</span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@station.io"
                  spellCheck={false}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="font-mono text-[10px] tracking-widest text-gray-400 uppercase block mb-2">
                Passphrase
              </label>
              <div className="terminal-line">
                <span className="prompt select-none">&gt;</span>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
                <span className="font-mono text-xs text-red-300 leading-relaxed">{error}</span>
              </div>
            )}

            {notice && (
              <div className="flex items-start gap-2 bg-accent-soft border border-accent/30 rounded-md px-3 py-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
                <span className="font-mono text-xs text-accent leading-relaxed">{notice}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed text-white font-mono text-xs tracking-widest uppercase rounded-md py-3 transition-all shadow-[0_0_16px_rgba(59,130,246,0.4)] hover:shadow-[0_0_24px_rgba(59,130,246,0.6)]"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'signin' ? (
                <LogIn className="w-4 h-4" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {mode === 'signin' ? 'AUTHENTICATE' : 'ENROLL'}
            </button>
          </form>
        </div>

        <p className="text-center font-mono text-[10px] text-gray-600 mt-6 tracking-wide">
          // records encrypted in transit — visible only to you
        </p>
      </div>
    </div>
  );
}
