import { CLEANER_DETAIL_INSET_CLASS } from "@/features/dashboards/cleanerJobDetailDisplay";
import type { CleanerJobTeamContext } from "@/features/dashboards/server/types";

type Props = {
  team: CleanerJobTeamContext;
};

export function CleanerTeamJobSection({ team }: Props) {
  if (!team.isTeamJob && !team.viewerRoleLabel) return null;

  const rosterParts = [
    team.viewerRoleLabel ? `Your role: ${team.viewerRoleLabel}` : null,
    team.leadCleanerName ? `Lead: ${team.leadCleanerName}` : null,
    team.supportCleanerNames.length > 0
      ? `Support: ${team.supportCleanerNames.join(", ")}`
      : null,
  ].filter(Boolean);

  return (
    <section className={`${CLEANER_DETAIL_INSET_CLASS} px-3.5 py-3 sm:px-4`}>
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Team job</h3>
      {rosterParts.length > 0 ? (
        <p className="mt-1.5 text-sm leading-snug text-zinc-800">{rosterParts.join(" · ")}</p>
      ) : null}
      {team.fasterCompletionRequested ? (
        <p className="mt-1.5 text-xs leading-snug text-zinc-600">
          Customer requested faster completion with an extra cleaner.
        </p>
      ) : null}
      {team.viewerRole === "support" && !team.canCompleteJob ? (
        <p className="mt-1.5 text-xs leading-snug text-zinc-500">
          Lead cleaner marks this job complete.
        </p>
      ) : null}
    </section>
  );
}
