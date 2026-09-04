import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "hoverable" | "flat" | "elevated";
  padding?: "none" | "sm" | "md" | "lg";
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = "default",
  padding = "md",
  className = "",
  ...props
}) => {
  const baseClasses = "bg-white rounded-2xl border border-slate-200/90 transition-all duration-200 overflow-hidden";

  const variantClasses = {
    default: "shadow-[0_1px_3px_rgba(11,31,58,0.04)]",
    hoverable: "shadow-[0_1px_3px_rgba(11,31,58,0.04)] hover:shadow-[0_8px_20px_rgba(11,31,58,0.08)] hover:-translate-y-0.5 cursor-pointer",
    flat: "border-slate-200 shadow-none bg-slate-50/60",
    elevated: "shadow-[0_10px_25px_-5px_rgba(11,31,58,0.08)]",
  };

  const paddingClasses = {
    none: "p-0",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
