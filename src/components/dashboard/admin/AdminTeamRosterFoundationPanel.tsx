import type { TeamRosterFoundationRow } from "@/features/dashboards/server/bookingCleanersReadModel";
import { AdminDetailSection } from "@/components/dashboard/admin/AdminDetailSection";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

type Props = {
  rows: TeamRosterFoundationRow[];
};

function toneForRosterStatus(
  status: TeamRosterFoundationRow["status"],
): "neutral" | "info" | "success" | "warning" {
  switch (status) {
    case "accepted":
    case "completed":
      return "success";
    case "offered":
    case "planned":
      return "info";
    case "declined":
    case "removed":
      return "warning";
    default:
      return "neutral";
  }
}

export function AdminTeamRosterFoundationPanel({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <AdminDetailSection
      title="Team roster"
      description="Lead and support participation on this booking. Booking lifecycle is driven by the lead cleaner only (NF-7F)."
      tone="ops"
      collapsible
    >
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center gap-2 border-b border-zinc-100 py-2 last:border-0"
          >
            <StatusBadge label={row.roleLabel} tone={row.role === "primary" ? "info" : "neutral"} />
            <StatusBadge label={row.statusLabel} tone={toneForRosterStatus(row.status)} />
            <span className="font-medium text-zinc-900">
              {row.cleanerLabel ?? row.cleanerId.slice(0, 8)}
            </span>
            <span className="text-xs text-zinc-500">
              Updated {new Date(row.updatedAt).toLocaleString("en-ZA")}
            </span>
            {row.role === "support" && row.supportCompletedAt ? (
              <span className="w-full text-xs text-emerald-700">
                Support confirmed{" "}
                {new Date(row.supportCompletedAt).toLocaleString("en-ZA")}
                {row.supportNote ? ` — ${row.supportNote}` : ""}
              </span>
            ) : row.role === "support" ? (
              <span className="w-full text-xs text-zinc-500">
                Support participation not yet confirmed
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </AdminDetailSection>
  );
}
