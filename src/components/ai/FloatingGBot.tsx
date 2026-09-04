import React from "react";
import { useGov } from "../../context/GovContext";
import { Sparkles, Bot } from "lucide-react";

export const FloatingGBot: React.FC = () => {
  const { openGBot, isGBotOpen } = useGov();

  if (isGBotOpen) return null;

  return (
    <div className="fixed bottom-20 md:bottom-8 right-5 z-40">
      <button
        onClick={() => openGBot()}
        className="group relative flex items-center gap-2.5 px-4 py-3 rounded-full bg-[#0b1f3a] text-white shadow-xl hover:shadow-2xl hover:bg-[#163158] hover:scale-105 active:scale-95 transition-all duration-200 border border-blue-400/30 cursor-pointer"
        aria-label="Ask G-Bot AI"
      >
        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
          <Bot className="w-4 h-4 text-amber-300" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-xs font-bold leading-none tracking-tight flex items-center gap-1">
            <span>Ask G-Bot</span>
            <Sparkles className="w-3 h-3 text-amber-300" />
          </span>
          <span className="text-[10px] text-slate-300 font-medium leading-tight mt-0.5">
            AI Sovereign Guide
          </span>
        </div>
      </button>
    </div>
  );
};
