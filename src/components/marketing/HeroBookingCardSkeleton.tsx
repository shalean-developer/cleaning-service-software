export function HeroBookingCardSkeleton() {
  return (
    <div
      className="marketing-hero-quote-card w-full rounded-3xl border border-white/80 bg-white p-7 sm:p-9 lg:max-w-[36rem] lg:justify-self-end xl:max-w-[38rem]"
      role="status"
      aria-label="Loading booking quote form"
    >
      <div className="h-4 w-24 animate-pulse rounded-md bg-slate-100" />
      <div className="mt-7 space-y-6">
        <div className="grid grid-cols-[minmax(0,1fr)_6.25rem_6.25rem] gap-5">
          <div className="h-14 animate-pulse rounded-2xl bg-slate-50" />
          <div className="h-14 animate-pulse rounded-2xl bg-slate-50" />
          <div className="h-14 animate-pulse rounded-2xl bg-slate-50" />
        </div>
        <div className="grid grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-50" />
          ))}
        </div>
      </div>
      <div className="mt-9 border-t border-slate-100 pt-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
            <div className="mt-3 h-10 w-28 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-14 w-full animate-pulse rounded-2xl bg-shalean-primary/20 sm:w-44" />
        </div>
      </div>
    </div>
  );
}
