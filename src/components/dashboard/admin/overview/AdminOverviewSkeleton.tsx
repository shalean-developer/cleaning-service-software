import {
  ADMIN_OVERVIEW_PANEL_CLASS,
  ADMIN_OVERVIEW_SNAPSHOT_SHELL_CLASS,
} from "@/components/dashboard/admin/overview/adminOverviewStyles";

function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} aria-hidden />;
}

export function AdminOverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading operations overview">
      <div className="space-y-3">
        <Bone className="h-3 w-24" />
        <Bone className="h-10 w-full max-w-md" />
        <Bone className="h-4 w-full max-w-xl" />
      </div>

      <div className={ADMIN_OVERVIEW_SNAPSHOT_SHELL_CLASS}>
        <Bone className="h-6 w-64" />
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <li key={index}>
              <Bone className="h-28 w-full" />
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className={`${ADMIN_OVERVIEW_PANEL_CLASS} p-5`}>
          <Bone className="mb-4 h-6 w-40" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Bone key={index} className="mb-3 h-14 w-full" />
          ))}
        </div>
        <div className="space-y-6">
          <div className={`${ADMIN_OVERVIEW_PANEL_CLASS} p-5`}>
            <Bone className="mb-4 h-6 w-36" />
            <Bone className="h-20 w-full" />
          </div>
          <div className={`${ADMIN_OVERVIEW_PANEL_CLASS} p-5`}>
            <Bone className="h-16 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
