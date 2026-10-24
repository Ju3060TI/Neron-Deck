import { useState } from 'react';
import { Gamepad2, Cookie } from 'lucide-react';

interface GameEntry {
  id: string;
  name: string;
  icon: typeof Cookie;
  src: string;
}

const GAMES: GameEntry[] = [
  { id: 'cookie-clicker', name: 'Cookie Clicker', icon: Cookie, src: '/games/cookieclicker/index.html' },
];

export default function GamesPage() {
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const activeGame = GAMES.find((g) => g.id === activeGameId) ?? null;

  return (
    <div className="h-[calc(100vh-3.5rem)] md:h-screen flex bg-[#09090b]">
      {/* Games sidebar */}
      <div className="w-56 shrink-0 bg-zinc-900/50 border-r border-zinc-800 flex flex-col">
        <div className="px-4 h-14 flex items-center border-b border-zinc-800 shrink-0">
          <Gamepad2 className="w-4 h-4 text-blue-400 mr-2" />
          <h2 className="text-sm font-semibold text-white">Games</h2>
        </div>
        <ul className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {GAMES.map((g) => {
            const active = activeGameId === g.id;
            const Icon = g.icon;
            return (
              <li key={g.id}>
                <button
                  onClick={() => setActiveGameId(g.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active ? 'bg-blue-600/15 text-blue-400' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{g.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Game area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeGame ? (
          <>
            <div className="flex items-center gap-2 px-5 h-14 border-b border-zinc-800 bg-zinc-900/40 shrink-0">
              <activeGame.icon className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-semibold text-white">{activeGame.name}</span>
            </div>
            <div className="flex-1 bg-black/40">
              <iframe
                src={activeGame.src}
                title={activeGame.name}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <Gamepad2 className="w-12 h-12 text-zinc-800 mb-4" strokeWidth={1.5} />
            <p className="text-sm text-zinc-400">Select a game to play</p>
            <p className="text-xs text-zinc-600 mt-1">Pick a game from the left sidebar to start playing.</p>
          </div>
        )}
      </div>
    </div>
  );
}
