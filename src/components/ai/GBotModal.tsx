import React, { useState, useEffect, useRef } from "react";
import { useGov } from "../../context/GovContext";
import {
  X, Send, Bot, User, Sparkles, RefreshCw, Plus, MessageSquare,
  Trash2, Globe2, ExternalLink, ShieldCheck, PanelLeftClose, PanelLeftOpen
} from "lucide-react";

interface Citation {
  title: string;
  url: string;
  snippet?: string;
  publishedAt?: string;
  sourceType: "u-gov" | "internet";
}
interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  source?: string;
  suggestions?: string[];
  citations?: Citation[];
  timestamp: string;
}
interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: Message[];
}

const renderInline = (line: string) => line.split(/(\\*\\*[^*]+\\*\\*|\\*[^*]+\\*|`[^`]+`)/g).map((part, index) => {
  if (part.startsWith("**") && part.endsWith("**")) return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
  if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
  if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-slate-100 px-1.5 py-0.5 text-[.9em] text-[#174EA6]">{part.slice(1, -1)}</code>;
  return <React.Fragment key={index}>{part}</React.Fragment>;
});
const renderMessageBody = (text: string) => (
  <div className="space-y-1.5">
    {text.split("\\n").map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={index} className="h-1" />;
      if (trimmed.startsWith("### ")) return <h3 key={index} className="pt-2 font-display text-base font-bold text-[#171717]">{renderInline(trimmed.slice(4))}</h3>;
      if (trimmed.startsWith("## ")) return <h3 key={index} className="pt-2 font-display text-lg font-bold text-[#171717]">{renderInline(trimmed.slice(3))}</h3>;
      if (/^(•|- )/.test(trimmed)) return <div key={index} className="flex gap-2"><span className="text-[#16834A]">•</span><span>{renderInline(trimmed.replace(/^(•|- )/, ""))}</span></div>;
      return <p key={index}>{renderInline(line)}</p>;
    })}
  </div>
);

const STORAGE_KEY = "ugov_gbot_conversations_v2";
const makeWelcome = (): Message => ({
  id: "welcome-" + Date.now(),
  sender: "bot",
  text: "Namaste! I’m **Bharat G-Bot**, your U-GOV assistant. Ask me about public services, government processes, scholarships, documents or general topics. When web research is configured, I can search the Internet and show the sources I used. I can also help you navigate U-GOV.

What would you like to explore?",
  source: "Bharat G-Bot • U-GOV V6",
  suggestions: [
    "Find scholarships for college students",
    "How do I renew a driving licence?",
    "Explain how a domicile certificate works",
    "What can U-GOV help me do?"
  ],
  timestamp: "Welcome"
});
const newConversation = (): Conversation => {
  const now = new Date().toISOString();
  return { id: "chat-" + Date.now(), title: "New conversation", updatedAt: now, messages: [makeWelcome()] };
};

export const GBotModal: React.FC = () => {
  const { isGBotOpen, closeGBot, gBotInitialPrompt, language, user, setActiveTab } = useGov();
  const storageKey = STORAGE_KEY + "_" + ((user as any)?.id || "guest");
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) && parsed.length ? parsed : [newConversation()];
    } catch { return [newConversation()]; }
  });
  const [activeId, setActiveId] = useState(() => conversations[0]?.id || "");
  const [loadedStorageKey, setLoadedStorageKey] = useState(storageKey);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeConversation = conversations.find((c) => c.id === activeId) || conversations[0];
  const messages = activeConversation?.messages || [];

  useEffect(() => {
    if (loadedStorageKey === storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      const parsed = saved ? JSON.parse(saved) : [];
      const next = Array.isArray(parsed) && parsed.length ? parsed : [newConversation()];
      setConversations(next);
      setActiveId(next[0].id);
    } catch {
      const next = [newConversation()];
      setConversations(next);
      setActiveId(next[0].id);
    }
    setLoadedStorageKey(storageKey);
  }, [storageKey, loadedStorageKey]);

  useEffect(() => {
    if (loadedStorageKey !== storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(conversations.slice(0, 30))); }
    catch { /* Browser storage may be unavailable or full; chat remains usable in memory. */ }
  }, [conversations, storageKey, loadedStorageKey]);

  useEffect(() => {
    if (activeConversation && activeConversation.id !== activeId) setActiveId(activeConversation.id);
  }, [activeConversation, activeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (gBotInitialPrompt && isGBotOpen) handleSend(gBotInitialPrompt);
    // Initial prompts are intentionally handled only when the modal is opened with a prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gBotInitialPrompt, isGBotOpen]);

  const updateActive = (updater: (current: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => c.id === activeId ? updater(c) : c));
  };

  const startNewChat = () => {
    const next = newConversation();
    setConversations((prev) => [next, ...prev]);
    setActiveId(next.id);
    setInput("");
  };

  const deleteConversation = (id: string) => {
    const remaining = conversations.filter((c) => c.id !== id);
    if (remaining.length) {
      setConversations(remaining);
      if (activeId === id) setActiveId(remaining[0].id);
    } else {
      const next = newConversation();
      setConversations([next]);
      setActiveId(next.id);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || isLoading || !activeConversation) return;
    const userMsg: Message = {
      id: "msg-" + Date.now(),
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    const history = messages.slice(-20);
    updateActive((c) => ({
      ...c,
      title: c.title === "New conversation" ? query.slice(0, 42) : c.title,
      updatedAt: new Date().toISOString(),
      messages: [...c.messages, userMsg]
    }));
    setInput("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          language,
          conversationHistory: history.slice(-12).map((m) => ({
            role: m.sender === "user" ? "user" : "model",
            text: m.text
          }))
        })
      });
      if (res.status === 401) throw new Error("Please sign in to use the personalized U-GOV assistant.");
      if (res.status === 429) throw new Error("You’ve reached the short-term request limit. Please wait a moment and try again.");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to generate guidance.");
      const botMsg: Message = {
        id: "msg-" + (Date.now() + 1),
        sender: "bot",
        text: data.reply || "I could not generate a useful answer. Please try rephrasing your question.",
        source: data.source || "U-GOV Assistant",
        suggestions: data.suggestions || [],
        citations: Array.isArray(data.citations) ? data.citations : [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      updateActive((c) => ({ ...c, updatedAt: new Date().toISOString(), messages: [...c.messages, botMsg] }));
    } catch (error: any) {
      updateActive((c) => ({
        ...c,
        messages: [...c.messages, {
          id: "error-" + Date.now(), sender: "bot",
          text: error?.message || "The assistant is temporarily unavailable. Please try again.",
          source: "Connection notice",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }]
      }));
    } finally { setIsLoading(false); }
  };

  if (!isGBotOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 lg:p-6">
      <button aria-label="Close assistant" className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={closeGBot} />
      <section className="relative z-10 flex h-[100dvh] w-full max-w-6xl overflow-hidden bg-white shadow-2xl sm:h-[90vh] sm:max-h-[900px] sm:rounded-[24px] sm:border sm:border-slate-200">
        {sidebarOpen && (
          <aside className="hidden w-[260px] shrink-0 flex-col border-r border-slate-200 bg-[#F5F7FB] md:flex">
            <div className="flex items-center justify-between px-4 py-5">
              <div className="flex items-center gap-2 font-display text-sm font-extrabold text-[#171717]">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#174EA6] text-white"><Bot size={17} /></span>
                Your conversations
              </div>
              <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-white" aria-label="Collapse sidebar"><PanelLeftClose size={17} /></button>
            </div>
            <button onClick={startNewChat} className="mx-3 mb-4 flex items-center justify-center gap-2 rounded-xl bg-[#174EA6] px-3 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#123B7A]">
              <Plus size={17} /> New conversation
            </button>
            <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
              {conversations.map((chat) => (
                <div key={chat.id} className={`group flex items-center gap-1 rounded-xl ${chat.id === activeId ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-white/80"}`}>
                  <button onClick={() => setActiveId(chat.id)} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left text-sm text-slate-700">
                    <MessageSquare size={15} className="shrink-0 text-[#174EA6]" />
                    <span className="truncate">{chat.title}</span>
                  </button>
                  <button onClick={() => deleteConversation(chat.id)} aria-label="Delete conversation" className="mr-1 rounded-lg p-2 text-slate-400 opacity-0 hover:bg-red-50 hover:text-[#D62828] group-hover:opacity-100"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 px-4 py-4 text-[11px] leading-relaxed text-slate-500">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-slate-700"><ShieldCheck size={13} className="text-[#16834A]" /> Your chat privacy</div>
              Conversation history is stored in this browser on this device. Avoid entering passwords, OTPs or sensitive identity details.
            </div>
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:inline-flex" aria-label="Open sidebar"><PanelLeftOpen size={18} /></button>}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#174EA6] text-[#F5C518] shadow-sm"><Sparkles size={21} /></div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-display text-base font-extrabold tracking-tight text-[#171717] sm:text-lg">Bharat G-Bot</h2>
                  <span className="rounded-full bg-[#EAF1FC] px-2 py-0.5 text-[10px] font-bold text-[#174EA6]">V6 AI</span>
                </div>
                <p className="truncate text-xs text-slate-500">Your personal guide to public services and information</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={startNewChat} className="rounded-xl p-2 text-[#174EA6] hover:bg-[#EAF1FC] md:hidden" aria-label="New chat"><Plus size={19} /></button>
              <button onClick={closeGBot} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-[#171717]" aria-label="Close G-Bot"><X size={20} /></button>
            </div>
          </header>

          <div className="flex items-center gap-2 border-b border-[#E6ECF4] bg-[#F8FAFD] px-4 py-2.5 text-[11px] text-slate-600 sm:px-6">
            <Globe2 size={14} className="text-[#174EA6]" />
            <span>U-GOV knowledge</span><span className="text-slate-300">•</span><span>Internet research when configured</span>
            <span className="ml-auto hidden items-center gap-1 text-[#16834A] sm:flex"><ShieldCheck size={13} /> Citizen data protected</span>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#F7F9FC] px-3 py-5 sm:px-7 sm:py-7">
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              {messages.map((m) => (
                <article key={m.id} className={`flex gap-3 ${m.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${m.sender === "user" ? "bg-[#171717] text-white" : "bg-[#174EA6] text-[#F5C518]"}`}>
                    {m.sender === "user" ? <User size={17} /> : <Bot size={18} />}
                  </div>
                  <div className={`min-w-0 max-w-[88%] sm:max-w-[84%] ${m.sender === "user" ? "text-right" : ""}`}>
                    <div className={`inline-block rounded-2xl px-4 py-3.5 text-left text-[14px] leading-7 shadow-sm sm:px-5 ${m.sender === "user" ? "rounded-tr-md bg-[#174EA6] text-white" : "rounded-tl-md border border-slate-200/80 bg-white text-[#252B35]"}`}>
                      <div className="break-words">{renderMessageBody(m.text)}</div>
                      {m.source && <div className={`mt-3 flex items-center gap-1.5 border-t pt-2 text-[10px] font-medium ${m.sender === "user" ? "border-white/20 text-blue-100" : "border-slate-100 text-slate-500"}`}><Sparkles size={12} /> {m.source}</div>}
                    </div>
                    {m.citations && m.citations.length > 0 && (
                      <div className="mt-3 space-y-2 text-left">
                        <p className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500"><Globe2 size={13} /> Sources used</p>
                        {m.citations.map((citation, index) => (
                          <a key={citation.url + index} href={citation.url} target={citation.sourceType === "internet" ? "_blank" : undefined} rel="noopener noreferrer" onClick={(event) => { if (citation.sourceType === "u-gov") { event.preventDefault(); setActiveTab("faq"); closeGBot(); } }} className="block rounded-xl border border-slate-200 bg-white p-3 transition hover:border-[#174EA6]/40 hover:shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-semibold leading-5 text-[#174EA6]">{citation.title}<span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">{citation.sourceType === "u-gov" ? "U-GOV" : "Internet"}</span></span>
                              <ExternalLink size={13} className="mt-0.5 shrink-0 text-slate-400" />
                            </div>
                            {citation.snippet && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-600">{citation.snippet}</p>}
                            {citation.publishedAt && <p className="mt-1 text-[10px] text-slate-400">Page date: {citation.publishedAt}</p>}
                          </a>
                        ))}
                      </div>
                    )}
                    {m.suggestions && m.suggestions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.suggestions.map((suggestion, i) => <button key={i} onClick={() => handleSend(suggestion)} disabled={isLoading} className="rounded-full border border-[#D7E2F2] bg-white px-3 py-1.5 text-[11px] font-medium text-[#174EA6] transition hover:border-[#174EA6] hover:bg-[#EAF1FC] disabled:opacity-50">{suggestion}</button>)}
                      </div>
                    )}
                    <p className={`mt-1.5 px-1 text-[10px] text-slate-400 ${m.sender === "user" ? "text-right" : ""}`}>{m.timestamp}</p>
                  </div>
                </article>
              ))}
              {isLoading && <div className="flex items-center gap-3 text-sm text-slate-500"><span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#174EA6] text-[#F5C518]"><RefreshCw size={16} className="animate-spin" /></span><span>Thinking and checking relevant information…</span></div>}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white px-3 pb-3 pt-3 sm:px-6 sm:pb-4">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-[#F8FAFD] p-2 shadow-inner focus-within:border-[#174EA6]/60 focus-within:ring-2 focus-within:ring-[#174EA6]/10">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Ask anything…"
                  rows={1}
                  className="max-h-32 min-h-[44px] flex-1 resize-y bg-transparent px-3 py-3 text-sm leading-6 text-[#171717] outline-none placeholder:text-slate-400"
                />
                <button onClick={() => handleSend()} disabled={!input.trim() || isLoading} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#174EA6] text-white shadow-sm transition hover:bg-[#123B7A] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message"><Send size={17} /></button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[10px] text-slate-400">
                <span>Enter to send · Shift + Enter for a new line</span>
                <span className="text-right">AI guidance can be inaccurate. Verify important information with official authorities.</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
