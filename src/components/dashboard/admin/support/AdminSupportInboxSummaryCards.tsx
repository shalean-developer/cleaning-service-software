import type { AdminSupportInboxSummary } from "@/features/support/server/adminSupportInboxReadModel";

type Props = {
  summary: AdminSupportInboxSummary;
};

const CARDS: {
  key: keyof AdminSupportInboxSummary;
  label: string;
  tone: string;
}[] = [
  { key: "open", label: "Open", tone: "border-blue-200 bg-blue-50/80 text-blue-900" },
  { key: "urgent", label: "Urgent", tone: "border-red-200 bg-red-50/80 text-red-900" },
  {
    key: "acknowledged",
    label: "Acknowledged",
    tone: "border-amber-200 bg-amber-50/80 text-amber-950",
  },
  {
    key: "resolvedToday",
    label: "Resolved today",
    tone: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
  },
];

export function AdminSupportInboxSummaryCards({ summary }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map((card) => (
        <div
          key={card.key}
          className={`rounded-2xl border px-4 py-3 ${card.tone}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{summary[card.key]}</p>
        </div>
      ))}
    </div>
  );
}
