import { useState } from 'react';
import { Loader2, Hexagon, AlertCircle, UserPlus, LogIn } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { USERNAME_PATTERN } from '@/lib/types';

export default function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
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

  async function handleGoogleSignIn() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (err) throw err;
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : 'Google sign-in failed.'));
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    const trimmedUsername = username.trim();
    if (mode === 'signup' && !USERNAME_PATTERN.test(trimmedUsername)) {
      setError('Nutzername: 3 bis 20 Zeichen, nur Buchstaben, Zahlen und Unterstrich.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: trimmedUsername } },
        });
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
            {mode === 'signup' && (
              <div>
                <label htmlFor="username" className="font-mono text-[10px] tracking-widest text-gray-400 uppercase block mb-2">
                  Nutzername
                </label>
                <div className="terminal-line">
                  <span className="prompt select-none">&gt;</span>
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="commander_01"
                    spellCheck={false}
                  />
                </div>
              </div>
            )}

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

          <div className="mt-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="font-mono text-[10px] tracking-widest text-gray-500 uppercase">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/15 disabled:opacity-60 disabled:cursor-not-allowed text-white font-mono text-xs tracking-widest uppercase rounded-md py-3 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </div>
        </div>

        <p className="text-center font-mono text-[10px] text-gray-600 mt-6 tracking-wide">
          // records encrypted in transit — visible only to you
        </p>
      </div>
    </div>
  );
}
