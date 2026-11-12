import { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, Code, Eye } from 'lucide-react';

type ViewTab = 'code' | 'preview';

export default function DevLab() {
  const [chatOpen, setChatOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>('code');

  return (
    <div className="h-[calc(100vh-3.5rem)] md:h-screen flex bg-[#1e1e1e] overflow-hidden">
      {/* ===== Left Panel — AI Chat ===== */}
      {chatOpen ? (
        <div className="w-[300px] shrink-0 flex flex-col bg-[#252526] border-r border-[#1e1e1e]">
          <div className="flex items-center justify-between h-11 px-3 border-b border-[#1e1e1e] shrink-0">
            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">KI Chat</span>
            <button
              onClick={() => setChatOpen(false)}
              className="p-1 text-zinc-500 hover:text-white transition-colors"
              title="Panel ausblenden"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-sm text-zinc-500 text-center">AI Chat hier</p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setChatOpen(true)}
          className="w-7 shrink-0 flex items-center justify-center bg-[#252526] border-r border-[#1e1e1e] text-zinc-500 hover:text-white transition-colors"
          title="Panel einblenden"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      )}

      {/* ===== Middle Panel — Code Editor ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-1 h-11 px-2 border-b border-[#1e1e1e] bg-[#252526] shrink-0">
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === 'code'
                ? 'bg-[#1e1e1e] text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            Code
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === 'preview'
                ? 'bg-[#1e1e1e] text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Vorschau
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <textarea
            placeholder="// Schreibe hier deinen Code…"
            spellCheck={false}
            className="w-full h-full resize-none bg-[#1e1e1e] text-zinc-200 font-mono text-sm p-4 focus:outline-none placeholder-zinc-600"
          />
        </div>
      </div>

      {/* ===== Right Panel — Preview ===== */}
      {activeTab === 'preview' && (
        <div className="w-[400px] shrink-0 flex flex-col bg-[#252526] border-l border-[#1e1e1e]">
          <div className="flex items-center h-11 px-3 border-b border-[#1e1e1e] shrink-0">
            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Vorschau</span>
          </div>
          <div className="flex-1 bg-white">
            <iframe
              title="preview"
              className="w-full h-full border-0"
              sandbox="allow-scripts"
              srcDoc="<!DOCTYPE html><html><body style='font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#333'><p>Vorschau-Platzhalter</p></body></html>"
            />
          </div>
        </div>
      )}
    </div>
  );
}
