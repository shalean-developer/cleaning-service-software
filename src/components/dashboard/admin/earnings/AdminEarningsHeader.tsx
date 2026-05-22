import Link from "next/link";
import {
  ADMIN_EARNINGS_PERIOD_CHIPS,
  ADMIN_EARNINGS_PERIOD_SUBTITLE,
  type AdminEarningsPeriod,
} from "@/features/earnings/server/adminEarningsDisplay";
import { buildAdminEarningsHref } from "@/features/earnings/server/adminEarningsUrl";
import {
  ADMIN_OVERVIEW_MUTED_CLASS,
  ADMIN_OVERVIEW_SECTION_LABEL_CLASS,
  ADMIN_OVERVIEW_SERIF_TITLE_CLASS,
} from "@/components/dashboard/admin/overview/adminOverviewStyles";

type Props = {
  period: AdminEarningsPeriod;
};

function periodChipClass(active: boolean): string {
  const base =
    "inline-flex shrink-0 items-center rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";
  return active
    ? `${base} border-blue-200/90 bg-blue-50 text-blue-800 shadow-sm`
    : `${base} border-slate-200/90 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50`;
}

export function AdminEarningsHeader({ period }: Props) {
  return (
    <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <p className={ADMIN_OVERVIEW_SECTION_LABEL_CLASS}>Earnings</p>
        <h1 className={`${ADMIN_OVERVIEW_SERIF_TITLE_CLASS} text-3xl sm:text-4xl`}>
          Revenue &amp; payouts
        </h1>
        <p className={ADMIN_OVERVIEW_MUTED_CLASS}>{ADMIN_EARNINGS_PERIOD_SUBTITLE[period]}</p>
      </div>
      <nav
        className="flex shrink-0 flex-wrap gap-1 rounded-xl border border-slate-200/90 bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        aria-label="Earnings time range"
      >
        {ADMIN_EARNINGS_PERIOD_CHIPS.map((chip) => {
          const active = period === chip.id;
          return (
            <Link
              key={chip.id}
              href={buildAdminEarningsHref(chip.id)}
              className={periodChipClass(active)}
              aria-current={active ? "page" : undefined}
            >
              {chip.label.toUpperCase()}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
