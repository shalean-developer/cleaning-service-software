import Link from "next/link";
import {
  ADMIN_OVERVIEW_MUTED_CLASS,
  ADMIN_OVERVIEW_PANEL_CLASS,
  ADMIN_OVERVIEW_PANEL_HEADER_CLASS,
  ADMIN_OVERVIEW_SERIF_TITLE_CLASS,
} from "@/components/dashboard/admin/overview/adminOverviewStyles";
import type { AdminHomeSupportRow } from "@/features/dashboards/adminHomeOperationsDisplay";

type Props = {
  rows: AdminHomeSupportRow[];
};

export function AdminSupportQueue({ rows }: Props) {
  return (
    <section className={ADMIN_OVERVIEW_PANEL_CLASS} aria-label="Support queue">
      <header className={ADMIN_OVERVIEW_PANEL_HEADER_CLASS}>
        <div className="space-y-1">
          <h2 className={ADMIN_OVERVIEW_SERIF_TITLE_CLASS}>Support queue</h2>
          <p className={ADMIN_OVERVIEW_MUTED_CLASS}>Customer issues awaiting ops response.</p>
        </div>
        <Link
          href="/admin/analytics/team-support"
          className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Open →
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">
          No open customer support signals.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={row.href}
                className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                  {row.customerInitials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{row.title}</span>
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        row.priority === "high"
                          ? "bg-blue-500"
                          : row.priority === "medium"
                            ? "bg-amber-400"
                            : "bg-slate-300"
                      }`}
                      aria-label={row.priority === "high" ? "Unread" : undefined}
                    />
                  </span>
                  <span className="block truncate text-sm text-slate-500">{row.detail}</span>
                </span>
                <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {row.timeLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
