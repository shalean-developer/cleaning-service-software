import Link from "next/link";
import { customerHubRebookHref } from "@/features/dashboards/customerHubDisplay";
import type { CustomerBookingListItem } from "@/features/dashboards/server/types";
import type { customerHubHeroCopy } from "@/features/dashboards/customerHubDisplay";

type HeroCopy = ReturnType<typeof customerHubHeroCopy>;

type Props = {
  copy: HeroCopy;
  featured: CustomerBookingListItem | null;
};

export function CustomerHomeHero({ copy, featured }: Props) {
  const rebookHref = customerHubRebookHref(featured?.display.serviceSlug ?? null);

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          {copy.eyebrow}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight text-shalean-navy sm:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">{copy.subtitle}</p>
      </div>
      <Link
        href={rebookHref}
        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shalean-primary focus-visible:ring-offset-2"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" d="M4 12a8 8 0 0 1 13.3-5.7M20 6v4h-4M20 12a8 8 0 0 1-13.3 5.7M4 18v-4h4" />
        </svg>
        Book again
      </Link>
    </header>
  );
}
