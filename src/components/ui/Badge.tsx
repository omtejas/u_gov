import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "pending" | "error" | "info" | "neutral" | "saffron";
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  size = "md",
  dot = false,
  className = "",
}) => {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px] font-medium tracking-wide",
    md: "px-2.5 py-1 text-xs font-semibold",
  };

  const variantClasses = {
    success: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border border-amber-200",
    pending: "bg-orange-50 text-orange-800 border border-orange-200",
    error: "bg-red-50 text-red-800 border border-red-200",
    info: "bg-blue-50 text-blue-800 border border-blue-200",
    neutral: "bg-slate-100 text-slate-700 border border-slate-200",
    saffron: "bg-amber-100/60 text-[#855800] border border-amber-300",
  };

  const dotClasses = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    pending: "bg-orange-500",
    error: "bg-red-500",
    info: "bg-blue-500",
    neutral: "bg-slate-400",
    saffron: "bg-[#b87a00]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotClasses[variant]}`} />}
      <span>{children}</span>
    </span>
  );
};
