import { AdminStatusPill } from "@/components/dashboard/admin/overview/AdminStatusPill";
import { ADMIN_OVERVIEW_MUTED_CLASS, ADMIN_OVERVIEW_SECTION_LABEL_CLASS, ADMIN_OVERVIEW_SERIF_TITLE_CLASS } from "@/components/dashboard/admin/overview/adminOverviewStyles";

export function AdminOverviewHero() {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <p className={ADMIN_OVERVIEW_SECTION_LABEL_CLASS}>Operations</p>
        <h1 className={`${ADMIN_OVERVIEW_SERIF_TITLE_CLASS} text-3xl sm:text-4xl`}>
          Today on Shalean
        </h1>
        <p className={`max-w-2xl ${ADMIN_OVERVIEW_MUTED_CLASS}`}>
          Calm command of bookings, cleaners, and support. at a glance.
        </p>
      </div>
      <div className="flex shrink-0 sm:justify-end">
        <AdminStatusPill />
      </div>
    </header>
  );
}
