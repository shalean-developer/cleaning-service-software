import {
  ADMIN_OVERVIEW_PANEL_CLASS,
  ADMIN_OVERVIEW_PANEL_HEADER_CLASS,
  ADMIN_OVERVIEW_SERIF_TITLE_CLASS,
} from "@/components/dashboard/admin/overview/adminOverviewStyles";
import {
  formatEarningsZar,
  type AdminEarningsServiceMixItem,
} from "@/features/earnings/server/adminEarningsDisplay";

type Props = {
  items: AdminEarningsServiceMixItem[];
  periodLabel: string;
};

export function AdminEarningsServiceMix({ items, periodLabel }: Props) {
  return (
    <section className={ADMIN_OVERVIEW_PANEL_CLASS} aria-label="Service revenue mix">
      <header className={ADMIN_OVERVIEW_PANEL_HEADER_CLASS}>
        <div className="space-y-1">
          <h2 className={ADMIN_OVERVIEW_SERIF_TITLE_CLASS}>Service revenue mix</h2>
          <p className="text-sm text-slate-500">{periodLabel} revenue across services.</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          {periodLabel}
        </span>
      </header>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">
          No paid bookings in this period yet.
        </p>
      ) : (
      <ul className="divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.id} className="px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                <p className="mt-1 text-xs text-slate-500">{item.mixPercent}% of mix</p>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
                  role="presentation"
                  aria-hidden
                >
                  <span
                    className="block h-full rounded-full bg-blue-500 transition-[width] duration-300"
                    style={{ width: `${item.mixPercent}%` }}
                  />
                </div>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                {formatEarningsZar(item.amountCents)}
              </p>
            </div>
          </li>
        ))}
      </ul>
      )}
    </section>
  );
}
