import Link from "next/link";
import {
  ADMIN_OVERVIEW_MUTED_CLASS,
  ADMIN_OVERVIEW_PANEL_CLASS,
  ADMIN_OVERVIEW_PANEL_HEADER_CLASS,
  ADMIN_OVERVIEW_SERIF_TITLE_CLASS,
} from "@/components/dashboard/admin/overview/adminOverviewStyles";
import type { AdminHomeDispatchAlert } from "@/features/dashboards/adminHomeOperationsDisplay";

function dispatchAlertSurface(severity: AdminHomeDispatchAlert["severity"]): string {
  switch (severity) {
    case "critical":
      return "border-red-200/90 bg-red-50/70";
    case "warning":
      return "border-amber-200/90 bg-amber-50/60";
    default:
      return "border-blue-200/80 bg-blue-50/50";
  }
}

function dispatchBadgeClass(severity: AdminHomeDispatchAlert["severity"]): string {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800";
    case "warning":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-blue-100 text-blue-800";
  }
}

type Props = {
  alerts: AdminHomeDispatchAlert[];
};

export function AdminDispatchAlerts({ alerts }: Props) {
  return (
    <section className={ADMIN_OVERVIEW_PANEL_CLASS} aria-label="Dispatch alerts">
      <header className={ADMIN_OVERVIEW_PANEL_HEADER_CLASS}>
        <div className="space-y-1">
          <h2 className={ADMIN_OVERVIEW_SERIF_TITLE_CLASS}>Dispatch alerts</h2>
          <p className={ADMIN_OVERVIEW_MUTED_CLASS}>SLA and matching risks needing review.</p>
        </div>
        <Link
          href="/admin/assignments"
          className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Open →
        </Link>
      </header>

      <div className="space-y-3 p-4 sm:p-5">
        {alerts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            <p>Dispatch queue is clear.</p>
            <Link
              href="/admin/assignments"
              className="mt-2 inline-flex min-h-9 items-center justify-center text-sm font-medium text-blue-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              aria-label="Open dispatch assignments"
            >
              Open dispatch →
            </Link>
          </div>
        ) : (
          <ul className="list-none space-y-3 p-0">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className={`flex flex-col gap-3 rounded-xl border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between ${dispatchAlertSurface(alert.severity)}`}
              >
                <div className="min-w-0">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${dispatchBadgeClass(alert.severity)}`}
                  >
                    {alert.severity}
                  </span>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">{alert.title}</p>
                  <p className="truncate text-sm text-slate-600">{alert.description}</p>
                </div>
                <Link
                  href={alert.href}
                  className="inline-flex min-h-9 shrink-0 items-center justify-center self-start rounded-lg border border-slate-200/90 bg-white/90 px-3.5 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:self-center"
                >
                  {alert.cta} →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
