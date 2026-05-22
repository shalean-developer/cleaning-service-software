import type { DispatchOrchestrationLaneSection as LaneSection } from "@/features/dashboards/adminDispatchOrchestrationDisplay";
import { AdminDispatchJobCard } from "@/components/dashboard/admin/dispatch/AdminDispatchJobCard";

type Props = {
  lane: LaneSection;
};

export function AdminDispatchLaneSection({ lane }: Props) {
  return (
    <section aria-label={`${lane.label} dispatch lane`}>
      <header className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="font-serif text-xl font-medium tracking-tight text-slate-900">
          {lane.label}
        </h2>
        <span className="text-sm text-slate-500">· {lane.window}</span>
        <span className="text-xs font-medium text-slate-400">
          ({lane.jobs.length} {lane.jobs.length === 1 ? "job" : "jobs"})
        </span>
      </header>

      {lane.jobs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center text-sm text-slate-500">
          No jobs in this lane today.
        </p>
      ) : (
        <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {lane.jobs.map((job) => (
            <li key={job.bookingId}>
              <AdminDispatchJobCard job={job} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
