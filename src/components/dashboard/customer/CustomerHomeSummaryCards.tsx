import Link from "next/link";
import {
  customerHomeSummaryCardHref,
  customerHomeSummaryValueForStat,
  type CustomerHomeSummaryStats,
} from "@/features/dashboards/customerHomeDisplay";
import { UI_CARD_SHELL_CLASS } from "@/lib/ui/productUiTokens";

type StatKey = keyof CustomerHomeSummaryStats;

const STAT_CONFIG: {
  key: StatKey;
  label: string;
  icon: "calendar" | "check" | "card" | "pin";
}[] = [
  { key: "upcoming", label: "Upcoming", icon: "calendar" },
  { key: "completed", label: "Completed", icon: "check" },
  { key: "pendingPayments", label: "Pending pay", icon: "card" },
  { key: "savedArea", label: "Saved area", icon: "pin" },
];

type Props = {
  stats: CustomerHomeSummaryStats;
};

function StatIcon({ kind }: { kind: (typeof STAT_CONFIG)[number]["icon"] }) {
  const className = "h-4 w-4 text-zinc-500";
  switch (kind) {
    case "calendar":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" d="M8 3v2m8-2v2M4 9h16M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
        </svg>
      );
    case "check":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
        </svg>
      );
    case "card":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path strokeLinecap="round" d="M3 10h18" />
        </svg>
      );
    case "pin":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10z" />
          <circle cx="12" cy="11" r="2" />
        </svg>
      );
    default:
      return null;
  }
}

export function CustomerHomeSummaryCards({ stats }: Props) {
  return (
    <section
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3"
      aria-label="Booking overview"
    >
      {STAT_CONFIG.map(({ key, label, icon }) => {
        const href = customerHomeSummaryCardHref(key);
        const value = customerHomeSummaryValueForStat(key, stats);
        const inner = (
          <>
            <span className="flex items-center gap-2">
              <StatIcon kind={icon} />
              <span className="text-xs font-medium text-zinc-500">{label}</span>
            </span>
            <p className="mt-2 truncate text-lg font-semibold tabular-nums tracking-tight text-zinc-900">
              {value}
            </p>
          </>
        );

        const className = `${UI_CARD_SHELL_CLASS} px-3 py-3 transition-colors sm:px-3.5 sm:py-3.5 ${
          href ? "hover:border-zinc-300 hover:bg-zinc-50/50" : ""
        }`;

        return href ? (
          <Link key={key} href={href} className={className}>
            {inner}
          </Link>
        ) : (
          <div key={key} className={className}>
            {inner}
          </div>
        );
      })}
    </section>
  );
}
