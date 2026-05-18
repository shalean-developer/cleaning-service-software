import { CLEANER_DETAIL_INSET_CLASS } from "@/features/dashboards/cleanerJobDetailDisplay";
import type { CleanerJobTeamContext } from "@/features/dashboards/server/types";

type Props = {
  team: CleanerJobTeamContext;
};

export function CleanerTeamJobSection({ team }: Props) {
  if (!team.isTeamJob && !team.viewerRoleLabel) return null;

  return (
    <section className={`${CLEANER_DETAIL_INSET_CLASS} p-4`}>
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Team job</h3>
      {team.viewerRoleLabel ? (
        <p className="mt-2 text-sm font-medium text-zinc-900">Your role: {team.viewerRoleLabel}</p>
      ) : null}
      {team.leadCleanerName ? (
        <p className="mt-1.5 text-sm text-zinc-700">Lead: {team.leadCleanerName}</p>
      ) : null}
      {team.supportCleanerNames.length > 0 ? (
        <p className="mt-1 text-sm text-zinc-700">
          Support: {team.supportCleanerNames.join(", ")}
        </p>
      ) : null}
      {team.fasterCompletionRequested ? (
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Customer requested faster completion with an additional cleaner.
        </p>
      ) : null}
      {team.viewerRole === "support" && !team.canCompleteJob ? (
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          The lead cleaner marks this job complete. You can review details here until then.
        </p>
      ) : null}
    </section>
  );
}
