import Link from "next/link";
import {
  labelForCleanerNetworkStatus,
  type AdminCleanerNetworkStats,
  type AdminCleanerNetworkStatus,
  type AdminCleanerNetworkViewFilter,
} from "@/features/cleaners/server/admin/adminCleanersNetworkDisplay";
import { buildAdminCleanersNetworkHref } from "@/features/cleaners/server/admin/adminCleanersNetworkUrl";

type Props = {
  stats: AdminCleanerNetworkStats;
  activeView: AdminCleanerNetworkViewFilter;
  search?: string;
};

const STAT_ORDER: AdminCleanerNetworkStatus[] = [
  "available",
  "on_visit",
  "paused",
  "offline",
];

const STAT_DOT_CLASS: Record<AdminCleanerNetworkStatus, string> = {
  available: "bg-emerald-500 text-white",
  on_visit: "bg-blue-600 text-white",
  paused: "bg-orange-500 text-white",
  offline: "bg-slate-400 text-white",
};

function statCardClass(active: boolean): string {
  const base =
    "flex min-w-[8.5rem] flex-1 flex-col gap-2 rounded-2xl border px-4 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";
  return active
    ? `${base} border-blue-200/90 bg-blue-50/80 shadow-[0_1px_3px_rgba(37,99,235,0.08)]`
    : `${base} border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:border-slate-300`;
}

export function AdminCleanersNetworkStats({ stats, activeView, search }: Props) {
  const current = { view: activeView === "all" ? undefined : activeView, q: search };

  return (
    <section
      className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4"
      aria-label="Cleaner network status summary"
    >
      {STAT_ORDER.map((status) => {
        const active = activeView === status;
        const count = stats[status];
        return (
          <Link
            key={status}
            href={buildAdminCleanersNetworkHref(current, {
              view: active ? undefined : status,
            })}
            className={statCardClass(active)}
            aria-current={active ? "true" : undefined}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              {labelForCleanerNetworkStatus(status)}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-2xl font-semibold tabular-nums text-slate-900">{count}</span>
              <span
                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${STAT_DOT_CLASS[status]}`}
                aria-hidden
              >
                {count}
              </span>
            </span>
          </Link>
        );
      })}
    </section>
  );
}
