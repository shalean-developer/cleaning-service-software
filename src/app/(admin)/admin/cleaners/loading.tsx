export default function AdminCleanersLoading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy aria-label="Loading cleaners">
      <div className="space-y-2">
        <div className="h-3 w-16 rounded bg-slate-200" />
        <div className="h-9 w-48 max-w-full rounded bg-slate-200" />
        <div className="h-4 w-72 max-w-full rounded bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-slate-200/80" />
        ))}
      </div>
      <div className="h-11 rounded-xl bg-slate-200/80" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-44 rounded-2xl bg-slate-200/80" />
        ))}
      </div>
    </div>
  );
}
