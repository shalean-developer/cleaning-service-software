"use client";

type Props = {
  className?: string;
};

export function AdminCorporateStatementPrintButton({ className }: Props) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ??
        "inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 print:hidden"
      }
    >
      Print statement
    </button>
  );
}
