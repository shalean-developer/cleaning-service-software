import type { InputHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={`marketing-focus-ring h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-shalean-navy shadow-sm placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${className}`.trim()}
      {...props}
    />
  );
}
