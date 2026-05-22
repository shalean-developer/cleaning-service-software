import type { ReactNode } from "react";

type Props = {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

export function Field({ label, error, hint, children }: Props) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {hint ? <span className="mb-1 block text-xs text-slate-500">{hint}</span> : null}
      {children}
      {error ? <span className="mt-1 block text-sm text-red-600">{error}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-shalean-navy outline-none focus:border-shalean-primary/80 focus:ring-2 focus:ring-shalean-primary/10";
