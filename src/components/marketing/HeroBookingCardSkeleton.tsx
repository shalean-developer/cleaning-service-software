export function HeroBookingCardSkeleton() {
  return (
    <div
      className="w-full rounded-2xl border border-shalean-border/80 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.12)] sm:p-7"
      aria-hidden
    >
      <div className="h-6 w-3/4 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_5.25rem_5.25rem] gap-3">
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
      <div className="mt-4 border-t border-shalean-border pt-4">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-8 w-20 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="mt-4 h-12 animate-pulse rounded-xl bg-shalean-primary/30" />
    </div>
  );
}
