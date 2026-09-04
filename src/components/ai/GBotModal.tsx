import React, { useState, useEffect, useRef } from "react";
import { useGov } from "../../context/GovContext";
import { X, Send, Bot, User, Sparkles, RefreshCw, ShieldCheck } from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  source?: string;
  suggestions?: string[];
  timestamp: string;
}

export const GBotModal: React.FC = () => {
  const { isGBotOpen, closeGBot, gBotInitialPrompt, language } = useGov();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-0",
      sender: "bot",
      text: "Namaste! I am **Bharat G-Bot**, your 24/7 Sovereign AI Public Services Assistant.\n\nI can help you navigate Indian Government schemes, eligibility criteria, required documents, application tracking, and statutory grievance redressals with zero hallucination.\n\nHow can I help you today?",
      source: "U-GOV National AI Public Services Engine",
      suggestions: [
        "What schemes am I eligible for?",
        "How to update mobile in Aadhaar?",
        "Check PM-Kisan e-KYC status",
        "Driving licence documents required",
      ],
      timestamp: "Just now",
    },
  ]);
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gBotInitialPrompt && isGBotOpen) {
      handleSend(gBotInitialPrompt);
    }
  }, [gBotInitialPrompt, isGBotOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (!isGBotOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query.trim(),
          language,
          conversationHistory: messages.map((m) => ({
            role: m.sender === "user" ? "user" : "model",
            text: m.text,
          })),
        }),
      });

      const data = await res.json();
      const botMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: "bot",
        text: data.reply || "I am processing your query against the public service registry.",
        source: data.source || "Sovereign Knowledge Base",
        suggestions: data.suggestions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const fallbackMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: "bot",
        text: "I am having trouble connecting to the live AI gateway. You can discover services directly in the Services Hub or check the National Citizen Helplines.",
        source: "Offline Fallback Resolver",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={closeGBot}
      />

      {/* Chat Window */}
      <div className="relative w-full max-w-2xl h-[85vh] max-h-[720px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-10 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#0b1f3a] text-white flex items-center justify-between border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-xs">
              <Bot className="w-5 h-5 text-amber-300" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm leading-tight text-white">
                  Bharat G-Bot
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  AI Public Engine
                </span>
              </div>
              <span className="text-[10px] text-slate-300">
                Grounded in official National Portals • Zero Hallucination
              </span>
            </div>
          </div>
          <button
            onClick={closeGBot}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#f8fafc]">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${
                m.sender === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`flex gap-2.5 max-w-[90%] sm:max-w-[85%] ${
                  m.sender === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    m.sender === "user"
                      ? "bg-slate-700 text-white"
                      : "bg-[#0b1f3a] text-amber-300"
                  }`}
                >
                  {m.sender === "user" ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                    m.sender === "user"
                      ? "bg-[#0057c2] text-white rounded-tr-none"
                      : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-none whitespace-pre-line"
                  }`}
                >
                  {m.text}

                  {/* Attribution Source */}
                  {m.source && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{m.source}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Suggestions */}
              {m.suggestions && m.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5 ml-9">
                  {m.suggestions.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(sug)}
                      className="px-2.5 py-1 rounded-full bg-white text-slate-700 text-xs font-medium border border-slate-200 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50/50 transition-all cursor-pointer shadow-2xs"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2.5 ml-1 text-slate-500 text-xs">
              <div className="w-7 h-7 rounded-full bg-[#0b1f3a] text-amber-300 flex items-center justify-center">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              </div>
              <span>Consulting official public service database...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask anything about government schemes, eligibility, or documents..."
            className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 placeholder:text-slate-400"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2.5 bg-[#0b1f3a] text-white rounded-xl font-semibold text-xs hover:bg-[#163158] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ask</span>
          </button>
        </div>
      </div>
    </div>
  );
};
