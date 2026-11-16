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
  const baseClasses = "bg-white rounded-[20px] border border-[#E3E9F1] transition-all duration-200 overflow-hidden";

  const variantClasses = {
    default: "shadow-[0_4px_16px_rgba(25,48,82,0.045)]",
    hoverable: "shadow-[0_4px_16px_rgba(25,48,82,0.045)] hover:shadow-[0_12px_28px_rgba(23,78,166,0.10)] hover:-translate-y-0.5 cursor-pointer",
    flat: "border-slate-200 shadow-none bg-slate-50/60",
    elevated: "shadow-[0_14px_34px_-8px_rgba(23,78,166,0.12)]",
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
