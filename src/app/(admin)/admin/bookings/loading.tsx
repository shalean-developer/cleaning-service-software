import { ADMIN_OVERVIEW_PANEL_CLASS } from "@/components/dashboard/admin/overview/adminOverviewStyles";

function SkeletonBar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} aria-hidden />;
}

export default function AdminBookingsLoading() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading bookings">
      <div className="space-y-2">
        <SkeletonBar className="h-3 w-20" />
        <SkeletonBar className="h-9 w-64 max-w-full" />
        <SkeletonBar className="h-4 w-80 max-w-full" />
      </div>
      <SkeletonBar className="h-11 w-full" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBar key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <ul className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className={`${ADMIN_OVERVIEW_PANEL_CLASS} p-5`}>
            <SkeletonBar className="mb-3 h-12 w-full" />
            <SkeletonBar className="mb-2 h-4 w-3/4 max-w-md" />
            <SkeletonBar className="h-9 w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
