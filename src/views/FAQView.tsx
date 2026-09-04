import React, { useState, useEffect } from "react";
import {
  BookOpen, Search, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Sparkles, RefreshCw, Filter
} from "lucide-react";
import { useGov } from "../context/GovContext";

interface FaqItem {
  id: string;
  category: string;
  categoryLabel: string;
  question: string;
  answer: string;
  helpful: number;
  notHelpful: number;
}

export const FAQView: React.FC = () => {
  const { openGBot } = useGov();
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [voted, setVoted] = useState<Record<string, "helpful" | "notHelpful">>({});

  const fetchFaq = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/v1/faq", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setFaq(data.faq || []);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchFaq(); }, []);

  const handleVote = async (id: string, vote: "helpful" | "notHelpful") => {
    if (voted[id]) return;
    try {
      const res = await fetch(`/api/v1/faq/${id}/vote`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote }),
      });
      if (res.ok) {
        setVoted((v) => ({ ...v, [id]: vote }));
        const data = await res.json();
        setFaq((prev) => prev.map((f) => f.id === id ? { ...f, helpful: data.votes.helpful, notHelpful: data.votes.notHelpful } : f));
      }
    } catch {
      // silent
    }
  };

  // Categories
  const categories = [
    { id: "all", label: "All Questions" },
    ...Array.from(new Set(faq.map((f) => f.category))).map((cat) => ({
      id: cat,
      label: faq.find((f) => f.category === cat)?.categoryLabel || cat,
    })),
  ];

  // Filter
  const filtered = faq.filter((f) => {
    const matchCat = activeCategory === "all" || f.category === activeCategory;
    const matchSearch = !searchQuery || f.question.toLowerCase().includes(searchQuery.toLowerCase()) || f.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-[#0b1f3a]" />
            <h1 className="text-2xl font-extrabold text-[#0b1f3a]">Help & FAQ</h1>
          </div>
          <p className="text-slate-500 text-sm">Frequently asked questions about U-GOV. Can't find your answer? Ask G-Bot.</p>
        </div>
        <button
          onClick={() => openGBot("How do I use U-GOV?")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold hover:brightness-110 shadow-sm transition-all shrink-0"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          Ask G-Bot
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search questions and answers…"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1f3a]/20 focus:border-[#0b1f3a]/40 transition-all"
        />
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-slate-400" />
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeCategory === cat.id ? "bg-[#0b1f3a] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {cat.label}
            {cat.id !== "all" && <span className="ml-1 opacity-60">({faq.filter((f) => f.category === cat.id).length})</span>}
          </button>
        ))}
      </div>

      {/* FAQ Accordion */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400">Loading FAQ…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">No matching questions found</p>
          <p className="text-slate-400 text-sm mt-1">Try a different search term or ask G-Bot for help.</p>
          <button
            onClick={() => openGBot(searchQuery || "How do I use U-GOV?")}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0b1f3a] text-white text-sm font-semibold"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            Ask G-Bot: "{searchQuery || "How do I use U-GOV?"}"
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const isExpanded = expandedId === item.id;
            const myVote = voted[item.id];
            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border transition-all ${
                  isExpanded ? "border-[#0b1f3a]/20 shadow-sm" : "border-slate-200/80"
                }`}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full mr-2 inline-block
                      ${item.category === "security" ? "bg-red-50 text-red-600" :
                        item.category === "consent" ? "bg-purple-50 text-purple-600" :
                        item.category === "documents" ? "bg-emerald-50 text-emerald-600" :
                        item.category === "services" ? "bg-blue-50 text-blue-600" :
                        "bg-slate-100 text-slate-500"}`}
                    >
                      {item.categoryLabel}
                    </span>
                    <span className={`text-sm font-semibold ${isExpanded ? "text-[#0b1f3a]" : "text-slate-800"}`}>
                      {item.question}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-slate-100">
                    <p className="text-sm text-slate-600 leading-relaxed mt-4">{item.answer}</p>

                    {/* Vote + G-Bot row */}
                    <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] text-slate-400 font-medium">Was this helpful?</span>
                        <button
                          onClick={() => handleVote(item.id, "helpful")}
                          disabled={!!myVote}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            myVote === "helpful"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "text-slate-500 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                          } disabled:cursor-not-allowed`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          {item.helpful}
                        </button>
                        <button
                          onClick={() => handleVote(item.id, "notHelpful")}
                          disabled={!!myVote}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            myVote === "notHelpful"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "text-slate-500 border-slate-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                          } disabled:cursor-not-allowed`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          {item.notHelpful}
                        </button>
                      </div>
                      <button
                        onClick={() => openGBot(item.question)}
                        className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:text-blue-800 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Ask G-Bot about this
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
