import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Headphones,
  RefreshCw,
  Sparkles,
  UserCheck,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  ADMIN_OVERVIEW_MUTED_CLASS,
  ADMIN_OVERVIEW_PANEL_CLASS,
  ADMIN_OVERVIEW_PANEL_HEADER_CLASS,
  ADMIN_OVERVIEW_SERIF_TITLE_CLASS,
} from "@/components/dashboard/admin/overview/adminOverviewStyles";
import type { AdminHomeLiveFeedItem } from "@/features/dashboards/adminHomeOperationsDisplay";

function feedVisual(kind: AdminHomeLiveFeedItem["kind"]): {
  icon: LucideIcon;
  tone: string;
} {
  switch (kind) {
    case "assignment":
      return { icon: UserCheck, tone: "bg-violet-100 text-violet-700" };
    case "confirmed":
      return { icon: Sparkles, tone: "bg-emerald-100 text-emerald-700" };
    case "support":
      return { icon: Headphones, tone: "bg-sky-100 text-sky-700" };
    case "risk":
      return { icon: AlertTriangle, tone: "bg-amber-100 text-amber-800" };
    case "completed":
      return { icon: CheckCircle2, tone: "bg-slate-100 text-slate-700" };
    case "recurring":
      return { icon: RefreshCw, tone: "bg-indigo-100 text-indigo-700" };
    case "payment":
      return { icon: Wallet, tone: "bg-red-100 text-red-700" };
    default:
      return { icon: Sparkles, tone: "bg-slate-100 text-slate-600" };
  }
}

function StreamingBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
      <span className="relative flex h-1.5 w-1.5" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
      </span>
      Streaming
    </span>
  );
}

type Props = {
  items: AdminHomeLiveFeedItem[];
};

export function AdminLiveOperationsFeed({ items }: Props) {
  return (
    <section className={`${ADMIN_OVERVIEW_PANEL_CLASS} min-h-[22rem] lg:min-h-[28rem]`} aria-label="Live operations feed">
      <header className={ADMIN_OVERVIEW_PANEL_HEADER_CLASS}>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={ADMIN_OVERVIEW_SERIF_TITLE_CLASS}>Live operations</h2>
            <StreamingBadge />
          </div>
          <p className={ADMIN_OVERVIEW_MUTED_CLASS}>
            Recent operational events across the network.
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-500">No recent operational activity.</p>
      ) : (
        <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
          {items.map((item) => {
            const { icon: Icon, tone } = feedVisual(item.kind);
            const linkable = item.linkable !== false;
            const rowClass =
              "group flex items-start gap-4 px-5 py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600";
            const inner = (
              <>
                <span
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 group-hover:text-slate-950">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-slate-500">{item.detail}</span>
                </span>
                <span className="shrink-0 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {item.timeLabel}
                </span>
              </>
            );

            return (
              <li key={item.id}>
                {linkable ? (
                  <Link
                    href={item.href}
                    className={`${rowClass} hover:bg-slate-50/80`}
                    aria-label={`${item.title}: ${item.detail}`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className={rowClass} role="listitem">
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
