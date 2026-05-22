import { LineChart, RefreshCw, ScrollText, Wallet } from "lucide-react";
import { AdminMetricCard } from "@/components/dashboard/admin/overview/AdminMetricCard";
import type { AdminEarningsSummaryCard } from "@/features/earnings/server/adminEarningsDisplay";

const CARD_ICONS = {
  revenue: LineChart,
  recurring: RefreshCw,
  queued: ScrollText,
  "cleaner-share": Wallet,
} as const;

type Props = {
  cards: AdminEarningsSummaryCard[];
};

export function AdminEarningsSummaryCards({ cards }: Props) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Earnings summary">
      {cards.map((card) => {
        const Icon = CARD_ICONS[card.id as keyof typeof CARD_ICONS] ?? LineChart;
        return (
          <AdminMetricCard
            key={card.id}
            label={card.label}
            value={card.value}
            footer={card.footer}
            icon={Icon}
            trend={card.trend}
          />
        );
      })}
    </section>
  );
}
