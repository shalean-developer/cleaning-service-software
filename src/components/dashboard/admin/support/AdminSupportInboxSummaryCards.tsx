import Link from "next/link";
import type { AdminSupportInboxSummary } from "@/features/support/server/adminSupportInboxReadModel";

type Props = {
  summary: AdminSupportInboxSummary;
};

const CARDS: {
  key: keyof AdminSupportInboxSummary;
  label: string;
  tone: string;
  filter?: string;
}[] = [
  { key: "open", label: "Open", tone: "border-blue-200 bg-blue-50/80 text-blue-900", filter: "open" },
  { key: "urgent", label: "Urgent", tone: "border-red-200 bg-red-50/80 text-red-900", filter: "urgent" },
  {
    key: "slaBreached",
    label: "SLA breached",
    tone: "border-red-300 bg-red-100/80 text-red-950",
    filter: "breached",
  },
  {
    key: "avgAcknowledgeMinutes",
    label: "Avg response",
    tone: "border-violet-200 bg-violet-50/80 text-violet-950",
  },
  {
    key: "avgResolveMinutes",
    label: "Avg resolution",
    tone: "border-indigo-200 bg-indigo-50/80 text-indigo-950",
  },
  {
    key: "resolvedToday",
    label: "Resolved today",
    tone: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
    filter: "recently_resolved",
  },
  {
    key: "escalationCount",
    label: "Escalations",
    tone: "border-orange-200 bg-orange-50/80 text-orange-950",
    filter: "needs_attention",
  },
  {
    key: "staleOpen24h",
    label: "Stale open (24h+)",
    tone: "border-amber-200 bg-amber-50/80 text-amber-950",
    filter: "aging",
  },
];

function formatMinutes(value: number | null): string {
  if (value == null) return "-";
  if (value < 60) return `${value}m`;
  const h = Math.floor(value / 60);
  const m = value % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function AdminSupportInboxSummaryCards({ summary }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      {CARDS.map((card) => {
        const raw = summary[card.key];
        const display =
          card.key === "avgAcknowledgeMinutes" || card.key === "avgResolveMinutes"
            ? formatMinutes(typeof raw === "number" ? raw : null)
            : String(raw ?? 0);

        const inner = (
          <>
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{display}</p>
          </>
        );

        if (!card.filter) {
          return (
            <div key={card.key} className={`rounded-2xl border px-4 py-3 ${card.tone}`}>
              {inner}
            </div>
          );
        }

        return (
          <Link
            key={card.key}
            href={`/admin/support?filter=${card.filter}`}
            className={`rounded-2xl border px-4 py-3 transition hover:opacity-90 ${card.tone}`}
          >
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
