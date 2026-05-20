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
    <section className="relative z-10 pb-8 lg:pb-12" aria-label="Company statistics">
      <MarketingContainer>
        <div className="marketing-card-shadow rounded-3xl border border-shalean-border bg-white px-8 py-8 lg:min-h-[7.5rem] lg:px-10 lg:py-8">
          <ul className="grid divide-y divide-shalean-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {STATS.map((stat) => {
              const Icon = statIcons[stat.icon];
              return (
                <li
                  key={stat.label}
                  className="flex flex-col items-center gap-3 py-6 text-center first:pt-0 last:pb-0 sm:flex-row sm:justify-center sm:gap-4 sm:py-0 sm:first:pl-0 sm:last:pr-0"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border-2 border-shalean-soft-blue bg-shalean-soft-blue/50 text-shalean-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="text-base text-slate-600 md:text-lg">
                    <span className="font-bold text-shalean-navy">{stat.value}</span>{" "}
                    {stat.label}
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
