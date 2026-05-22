import {
  formatRegistryZar,
  type AdminCustomerRegistryStats,
} from "@/features/customers/server/admin/adminCustomersRegistryDisplay";

type Props = {
  stats: AdminCustomerRegistryStats;
};

const STAT_CARD_CLASS =
  "flex min-w-0 flex-1 flex-col gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]";

export function AdminCustomersRegistryStats({ stats }: Props) {
  return (
    <section
      className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3"
      aria-label="Customer registry summary"
    >
      <div className={STAT_CARD_CLASS}>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
          Total customers
        </span>
        <span className="text-2xl font-semibold tabular-nums text-slate-900">
          {stats.totalCustomers}
        </span>
      </div>
      <div className={STAT_CARD_CLASS}>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
          Recurring
        </span>
        <span className="text-2xl font-semibold tabular-nums text-slate-900">
          {stats.recurringCustomers}
        </span>
      </div>
      <div className={STAT_CARD_CLASS}>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
          Lifetime value
        </span>
        <span className="text-2xl font-semibold tabular-nums text-slate-900">
          {formatRegistryZar(stats.lifetimeValueCents)}
        </span>
      </div>
    </section>
  );
}
