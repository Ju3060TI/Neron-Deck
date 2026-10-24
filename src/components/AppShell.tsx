import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Vault, MessageSquare, Bot, Settings as SettingsIcon, LogOut, Menu, X, Gamepad2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const navItems = [
  { to: '/vault', label: 'Vault', icon: Vault },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/games', label: 'Games', icon: Gamepad2 },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-5 h-16 border-b border-zinc-800">
      <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
        <span className="text-white text-sm font-bold">N</span>
      </div>
      <span className="text-sm font-bold text-white tracking-tight">Neron-Deck</span>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-3">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-600/15 text-blue-400'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`
          }
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function Footer({ email, onLogout, onNavigate }: { email?: string; onLogout: () => void; onNavigate?: () => void }) {
  return (
    <div className="px-3 py-4 border-t border-zinc-800">
      {email && (
        <div className="flex items-center gap-2 px-3 mb-2">
          <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-300 shrink-0">
            {email.slice(0, 2).toUpperCase()}
          </div>
          <p className="text-xs text-zinc-500 truncate" title={email}>
            {email}
          </p>
        </div>
      )}
      <NavLink
        to="/settings"
        onClick={onNavigate}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors mb-1"
      >
        <SettingsIcon className="w-4 h-4" />
        <span>Settings</span>
      </NavLink>
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span>Sign out</span>
      </button>
    </div>
  );
}

export default function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await signOut();
    navigate('/auth');
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-zinc-900/50 border-r border-zinc-800 z-30">
        <Logo />
        <div className="flex-1">
          <NavLinks />
        </div>
        <Footer email={user?.email} onLogout={handleLogout} />
      </aside>

      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">N</span>
          </div>
          <span className="text-sm font-bold text-white">Neron-Deck</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -mr-2 text-zinc-400 hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
            <div className="flex items-center justify-between">
              <Logo />
              <button
                onClick={() => setMobileOpen(false)}
                className="p-3 text-zinc-400 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1">
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </div>
            <Footer email={user?.email} onLogout={handleLogout} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <main className="md:pl-60 pt-14 md:pt-0 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
