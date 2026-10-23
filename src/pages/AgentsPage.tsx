import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, MessageSquare, Trash2, SendHorizonal, KeyRound, Bot, User, AlertCircle, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { GROQ_API_URL, GROQ_MODEL, GROQ_KEY_STORAGE } from '@/lib/types';
import type { AiSession, AiSessionMessage } from '@/lib/types';
import { markdownToHtml } from '@/lib/markdown';

function getStoredKey(): string {
  try {
    return sessionStorage.getItem(GROQ_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

export default function AgentsPage() {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState(getStoredKey);
  const [sessions, setSessions] = useState<AiSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiSessionMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId]
  );

  const groupedSessions = useMemo(() => {
    const today = sessions.filter((s) => isToday(s.updated_at));
    const older = sessions.filter((s) => !isToday(s.updated_at));
    return { today, older };
  }, [sessions]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
  }

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    const { data, error } = await supabase
      .from('ai_sessions')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) {
      showToast('Could not load sessions.');
    } else {
      setSessions(data ?? []);
    }
    setLoadingSessions(false);
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const fetchMessages = useCallback(async () => {
    if (!activeId) return;
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('ai_session_messages')
      .select('*')
      .eq('session_id', activeId)
      .order('created_at', { ascending: true });
    if (error) {
      showToast('Could not load messages.');
    } else {
      setMessages(data ?? []);
    }
    setLoadingMessages(false);
  }, [activeId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Listen for API key changes from Settings
  useEffect(() => {
    const interval = setInterval(() => {
      const current = getStoredKey();
      setApiKey((prev) => (prev !== current ? current : prev));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  async function createSession() {
    const { data, error } = await supabase
      .from('ai_sessions')
      .insert({ title: 'New Chat' })
      .select('*')
      .single();
    if (error || !data) {
      showToast('Could not create session.');
      return;
    }
    setSessions((prev) => [data, ...prev]);
    setActiveId(data.id);
  }

  async function deleteSession(id: string) {
    const { error } = await supabase.from('ai_sessions').delete().eq('id', id);
    if (error) {
      showToast('Could not delete session.');
      return;
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || !activeId || !apiKey) return;

    setInput('');
    setSending(true);

    // Save user message
    const { data: userMsg, error: insertErr } = await supabase
      .from('ai_session_messages')
      .insert({ session_id: activeId, role: 'user', content: text })
      .select('*')
      .single();
    if (insertErr || !userMsg) {
      showToast('Failed to save message.');
      setSending(false);
      return;
    }
    setMessages((prev) => [...prev, userMsg]);

    // Update session title if first message
    if (messages.length === 0) {
      const title = text.slice(0, 40) + (text.length > 40 ? '...' : '');
      supabase.from('ai_sessions').update({ title }).eq('id', activeId).then(() => {
        setSessions((prev) =>
          prev.map((s) => (s.id === activeId ? { ...s, title } : s))
        );
      });
    }

    // Call Groq with vault note tools
    try {
      const allMessages = [...messages, userMsg];

      const tools = [
        {
          type: 'function',
          function: {
            name: 'create_vault_note',
            description: 'Create a new note in the user\'s vault.',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'The note title' },
                content: { type: 'string', description: 'The note content (markdown)' },
                file_type: { type: 'string', enum: ['markdown', 'code'], description: 'Note type' },
                language: { type: 'string', description: 'Code language if file_type is code' },
              },
              required: ['title', 'content'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'read_vault_notes',
            description: 'Read the titles and content of all vault notes.',
            parameters: { type: 'object', properties: {} },
          },
        },
      ];

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: 'You are Neron-Deck, a concise, helpful AI assistant. You can create and read vault notes using the provided tools when the user asks.' },
            ...allMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
          tools,
        }),
      });

      if (!response.ok) {
        let detail = `Request failed (${response.status})`;
        try {
          const body = await response.json();
          if (body?.error?.message) detail = body.error.message;
        } catch {
          // keep default
        }
        if (response.status === 401) detail = 'Invalid API key. Update it in Settings.';
        else if (response.status === 429) detail = 'Rate limit reached. Please wait.';
        throw new Error(detail);
      }

      const data = await response.json();
      const message = data?.choices?.[0]?.message;

      // Handle tool calls
      if (message?.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
        let toolResultSummary = '';
        for (const call of message.tool_calls) {
          const fnName = call.function?.name;
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(call.function?.arguments ?? '{}'); } catch { /* ignore */ }

          if (fnName === 'create_vault_note') {
            const { data: noteData } = await supabase
              .from('vault_notes')
              .insert({
                title: String(args.title ?? 'Untitled'),
                content: String(args.content ?? ''),
                file_type: (args.file_type as 'markdown' | 'code') ?? 'markdown',
                language: args.language ? String(args.language) : null,
              })
              .select('*')
              .single();
            toolResultSummary += noteData
              ? `Created note "${noteData.title}". `
              : 'Failed to create note. ';
          } else if (fnName === 'read_vault_notes') {
            const { data: notes } = await supabase
              .from('vault_notes')
              .select('title, file_type, language, content')
              .order('updated_at', { ascending: false })
              .limit(20);
            if (notes && notes.length > 0) {
              toolResultSummary += `Found ${notes.length} notes: ${notes.map((n) => `"${n.title}"`).join(', ')}. `;
            } else {
              toolResultSummary += 'No vault notes found. ';
            }
          }
        }

        // Send a follow-up request with the tool results
        const followUpResponse = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: 'system', content: 'You are Neron-Deck, a concise, helpful AI assistant.' },
              ...allMessages.map((m) => ({ role: m.role, content: m.content })),
              message,
              { role: 'tool', tool_call_id: message.tool_calls[0].id, content: toolResultSummary },
            ],
          }),
        });

        if (followUpResponse.ok) {
          const followUpData = await followUpResponse.json();
          const followReply: unknown = followUpData?.choices?.[0]?.message?.content;
          if (typeof followReply === 'string') {
            const finalReply = `${followReply}\n\n_Vault tool: ${toolResultSummary.trim()}_`;
            const { data: aiMsg } = await supabase
              .from('ai_session_messages')
              .insert({ session_id: activeId, role: 'assistant', content: finalReply })
              .select('*')
              .single();
            if (aiMsg) setMessages((prev) => [...prev, aiMsg]);
          }
        }
      } else {
        const reply: unknown = message?.content;
        if (typeof reply !== 'string') throw new Error('Unexpected response.');

        const { data: aiMsg, error: aiErr } = await supabase
          .from('ai_session_messages')
          .insert({ session_id: activeId, role: 'assistant', content: reply })
          .select('*')
          .single();
        if (aiErr || !aiMsg) {
          showToast('AI replied but save failed.');
        } else {
          setMessages((prev) => [...prev, aiMsg]);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reach AI.';
      showToast(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] md:h-screen flex relative bg-zinc-950">
      {/* Session sidebar */}
      <div className="w-64 shrink-0 bg-zinc-900 flex flex-col h-full border-r border-zinc-800">
        <div className="p-3 border-b border-zinc-800">
          <button
            onClick={createSession}
            className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loadingSessions ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="w-8 h-8 text-zinc-700 mb-3" strokeWidth={1.5} />
              <p className="text-sm text-zinc-500">No conversations yet</p>
            </div>
          ) : (
            <>
              {groupedSessions.today.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider px-2 mb-1">Today</p>
                  {groupedSessions.today.map((s) => (
                    <SessionItem
                      key={s.id}
                      session={s}
                      active={activeId === s.id}
                      onSelect={() => setActiveId(s.id)}
                      onDelete={() => deleteSession(s.id)}
                    />
                  ))}
                </div>
              )}
              {groupedSessions.older.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider px-2 mb-1">Older</p>
                  {groupedSessions.older.map((s) => (
                    <SessionItem
                      key={s.id}
                      session={s}
                      active={activeId === s.id}
                      onSelect={() => setActiveId(s.id)}
                      onDelete={() => deleteSession(s.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {activeSession ? (
          <>
            <div className="flex items-center gap-2 px-5 h-14 border-b border-zinc-800 bg-zinc-900 shrink-0">
              <Bot className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-white truncate">{activeSession.title}</h2>
              <span className="text-[11px] text-zinc-600 ml-auto hidden sm:inline">{GROQ_MODEL}</span>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
              <div className="max-w-2xl mx-auto space-y-6">
                {loadingMessages ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Bot className="w-10 h-10 text-zinc-700 mb-4" strokeWidth={1.5} />
                    <p className="text-sm text-zinc-400">Start chatting with AI</p>
                    <p className="text-xs text-zinc-600 mt-1">Type a message below to begin.</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="flex gap-3 animate-fade-in-up">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          msg.role === 'user' ? 'bg-blue-600' : 'bg-zinc-700'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <User className="w-4 h-4 text-white" />
                        ) : (
                          <Bot className="w-4 h-4 text-zinc-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-white">
                            {msg.role === 'user' ? 'You' : 'Neron-Deck'}
                          </span>
                          <span className="text-[10px] text-zinc-600">{formatTime(msg.created_at)}</span>
                        </div>
                        {msg.role === 'user' ? (
                          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                        ) : (
                          <div
                            className="markdown-preview text-sm text-zinc-300 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }}
                          />
                        )}
                      </div>
                    </div>
                  ))
                )}
                {sending && (
                  <div className="flex gap-3 animate-fade-in">
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-zinc-300" />
                    </div>
                    <div className="flex items-center gap-1 py-2">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce-dot"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {toast && (
              <div className="px-4 pb-1 max-w-2xl mx-auto w-full">
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-red-400 shrink-0" />
                  <span className="text-xs text-red-400">{toast}</span>
                  <button onClick={() => setToast(null)} className="ml-auto text-red-400/60 hover:text-red-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {!apiKey && (
              <div className="px-4 pb-1 max-w-2xl mx-auto w-full">
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs text-amber-400">
                    Add your Groq API key in Settings to start chatting with AI.
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleSend} className="shrink-0 border-t border-zinc-800 bg-zinc-900 p-3">
              <div className="max-w-2xl mx-auto flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={apiKey ? 'Message AI...' : 'Add API key in Settings first...'}
                  disabled={sending || !apiKey}
                  rows={1}
                  className="flex-1 resize-none bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors max-h-32 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending || !apiKey}
                  className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white transition-colors"
                  aria-label="Send"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <Bot className="w-12 h-12 text-zinc-700 mb-4" strokeWidth={1.5} />
            <p className="text-sm text-zinc-400">Select or create a chat</p>
            <p className="text-xs text-zinc-600 mt-1">Your AI conversations are saved automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionItem({
  session,
  active,
  onSelect,
  onDelete,
}: {
  session: AiSession;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 mb-0.5 cursor-pointer transition-colors ${
        active ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
      }`}
      onClick={onSelect}
    >
      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-zinc-300' : 'text-zinc-600'}`} />
      <p className={`text-sm truncate flex-1 ${active ? 'text-white' : 'text-zinc-400'}`}>
        {session.title}
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all shrink-0"
        aria-label="Delete session"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
