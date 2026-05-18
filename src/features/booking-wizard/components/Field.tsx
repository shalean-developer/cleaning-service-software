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
      <span className="mb-1 block text-sm font-medium text-zinc-800">{label}</span>
      {hint ? <span className="mb-1 block text-xs text-zinc-500">{hint}</span> : null}
      {children}
      {error ? <span className="mt-1 block text-sm text-red-600">{error}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200";
