import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "saffron";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  className = "",
  disabled,
  ...props
}) => {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-6 py-2.5 text-base gap-2.5 font-semibold",
  };

  const variantClasses = {
    primary:
      "bg-[#174EA6] text-white hover:bg-[#123B7A] active:bg-[#123B7A] focus:ring-blue-500 shadow-sm",
    secondary:
      "bg-[#123B7A] text-white hover:bg-[#174EA6] active:bg-[#123B7A] focus:ring-blue-400 shadow-sm",
    outline:
      "bg-white border border-[#cbd5e1] text-[#1e293b] hover:bg-[#f8fafc] hover:border-[#94a3b8] focus:ring-slate-300",
    ghost:
      "bg-transparent text-[#334155] hover:bg-[#f1f5f9] hover:text-[#0f172a] focus:ring-slate-200",
    danger:
      "bg-[#D62828] text-white hover:bg-[#B91F1F] focus:ring-red-400 shadow-sm",
    saffron:
      "bg-[#F5C518] text-[#171717] hover:bg-[#E7B600] active:bg-[#D8AA00] focus:ring-amber-500 shadow-sm font-semibold",
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      ) : leftIcon ? (
        <span className="shrink-0">{leftIcon}</span>
      ) : null}
      <span>{children}</span>
      {!isLoading && rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
    </button>
  );
};
