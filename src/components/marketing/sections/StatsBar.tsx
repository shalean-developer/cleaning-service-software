import { STATS } from "@/features/marketing/constants";
import { IconHome, IconStar, IconUsers } from "../icons";
import { MarketingContainer } from "../MarketingContainer";

const statIcons = {
  home: IconHome,
  users: IconUsers,
  star: IconStar,
} as const;

export function StatsBar() {
  return (
    <section
      className="relative z-10 -mt-4 bg-shalean-surface pb-4 pt-2 sm:-mt-6 sm:pb-6 sm:pt-3 lg:-mt-8"
      aria-label="Company statistics"
    >
      <MarketingContainer>
        <div className="rounded-2xl border border-shalean-border/80 bg-white px-5 py-5 marketing-card-shadow-sm sm:rounded-3xl sm:px-8 sm:py-7">
          <ul className="grid divide-y divide-shalean-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {STATS.map((stat) => {
              const Icon = statIcons[stat.icon];
              return (
                <li
                  key={stat.label}
                  className="flex flex-col items-center gap-3 py-5 text-center first:pt-0 last:pb-0 sm:flex-row sm:justify-center sm:gap-4 sm:py-0 sm:px-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border-2 border-shalean-soft-blue bg-shalean-soft-blue/50 text-shalean-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="marketing-prose text-center sm:text-base">
                    <span className="block text-lg font-bold text-shalean-navy sm:inline sm:text-xl">
                      {stat.value}
                    </span>{" "}
                    <span className="font-medium">{stat.label}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </MarketingContainer>
    </section>
  );
}
