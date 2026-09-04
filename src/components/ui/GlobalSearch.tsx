import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, FileText, Layers, BookOpen, Zap, History, ArrowRight, Loader2 } from "lucide-react";
import { useGov } from "../../context/GovContext";

interface SearchResult {
  type: "service" | "document" | "application" | "faq" | "feature";
  id: string;
  title: string;
  subtitle: string;
  tab?: string;
  relevance: number;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  service: Layers,
  document: FileText,
  application: History,
  faq: BookOpen,
  feature: Zap,
};

const TYPE_LABELS: Record<string, string> = {
  service: "Service",
  document: "Document",
  application: "Application",
  faq: "FAQ",
  feature: "Feature",
};

const TYPE_COLORS: Record<string, string> = {
  service: "bg-blue-100 text-blue-700",
  document: "bg-emerald-100 text-emerald-700",
  application: "bg-amber-100 text-amber-700",
  faq: "bg-purple-100 text-purple-700",
  feature: "bg-indigo-100 text-indigo-700",
};

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const { setActiveTab } = useGov();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setResults(data.results || []);
        setSelectedIndex(0);
      }
    } catch {
      // ignore — search is non-critical
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  const navigateToResult = useCallback(
    (result: SearchResult) => {
      if (result.tab) setActiveTab(result.tab);
      onClose();
    },
    [setActiveTab, onClose]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      navigateToResult(results[selectedIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200/50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin shrink-0" />
          ) : (
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search services, documents, applications, FAQ..."
            className="flex-1 text-[15px] text-slate-900 placeholder:text-slate-400 bg-transparent outline-none"
            spellCheck={false}
            autoComplete="off"
          />
          {query && (
            <button onClick={() => setQuery("")} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-mono border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <div className="max-h-[60vh] overflow-y-auto py-2">
            {results.map((result, idx) => {
              const Icon = TYPE_ICONS[result.type] || Zap;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => navigateToResult(result)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isSelected ? "bg-slate-50" : "hover:bg-slate-50"
                  }`}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 truncate">{result.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${TYPE_COLORS[result.type]}`}>
                        {TYPE_LABELS[result.type]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{result.subtitle}</p>
                  </div>
                  <ArrowRight className={`w-4 h-4 shrink-0 transition-opacity ${isSelected ? "opacity-100 text-slate-400" : "opacity-0"}`} />
                </button>
              );
            })}
          </div>
        ) : query.length >= 2 && !isLoading ? (
          <div className="py-12 text-center">
            <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">No results for "<span className="text-slate-700">{query}</span>"</p>
            <p className="text-xs text-slate-400 mt-1">Try a different search term or browse by category</p>
          </div>
        ) : query.length < 2 && !query ? (
          <div className="px-4 py-5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick Navigation</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Services Catalogue", tab: "services", icon: Layers },
                { label: "DigiVault", tab: "documents", icon: FileText },
                { label: "Application Tracker", tab: "tracker", icon: History },
                { label: "Help & FAQ", tab: "faq", icon: BookOpen },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.tab}
                    onClick={() => { setActiveTab(item.tab); onClose(); }}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-left border border-slate-100"
                  >
                    <Icon className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            {results.length > 0 ? `${results.length} result${results.length !== 1 ? "s" : ""}` : "Type to search across U-GOV"}
          </span>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 font-mono text-[10px]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 font-mono text-[10px]">↵</kbd>
              open
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
