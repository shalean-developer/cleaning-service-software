import type { DeferredDispatchStatus } from "@/features/assignments/server/deferredDispatchStatus";
import {
  ADMIN_DETAIL_CARD_CLASS,
  ADMIN_SECTION_MUTED_CLASS,
  ADMIN_SECTION_TITLE_CLASS,
} from "@/features/dashboards/adminDisplay";

type Props = {
  deferredDispatch: DeferredDispatchStatus;
  /** When nested inside AdminDetailSection, omit duplicate card chrome. */
  embedded?: boolean;
};

export function AdminDeferredDispatchPanel({ deferredDispatch, embedded = false }: Props) {
  if (deferredDispatch.phase === "not_applicable") return null;

  const toneClass =
    deferredDispatch.phase === "dispatch_overdue"
      ? "border-amber-300/80 bg-amber-50/40"
      : deferredDispatch.phase === "ready_for_dispatch"
        ? "border-sky-300/80 bg-sky-50/30"
        : "border-zinc-200/80 bg-zinc-50/50";

  const body = (
    <>
      {!embedded ? (
        <>
          <h2 className={ADMIN_SECTION_TITLE_CLASS}>Deferred assignment</h2>
          <p className={ADMIN_SECTION_MUTED_CLASS}>
            {deferredDispatch.adminOperationalCopy ?? deferredDispatch.adminLabel}
          </p>
        </>
      ) : (
        <p className={`${ADMIN_SECTION_MUTED_CLASS} text-sm`}>
          {deferredDispatch.adminOperationalCopy ?? deferredDispatch.adminLabel}
        </p>
      )}

      <dl className={`grid gap-3 text-sm sm:grid-cols-2 ${embedded ? "mt-2" : "mt-3"}`}>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Phase</dt>
          <dd className="mt-0.5 font-medium text-zinc-900">{deferredDispatch.adminLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Dispatch at
          </dt>
          <dd className="mt-0.5 font-medium text-zinc-900">
            {deferredDispatch.assignmentDispatchAt
              ? new Date(deferredDispatch.assignmentDispatchAt).toLocaleString("en-ZA")
              : "—"}
          </dd>
        </div>
        {deferredDispatch.scheduledStart ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Service start
            </dt>
            <dd className="mt-0.5 font-medium text-zinc-900">
              {new Date(deferredDispatch.scheduledStart).toLocaleString("en-ZA")}
            </dd>
          </div>
        ) : null}
        {deferredDispatch.hoursUntilDispatch != null && deferredDispatch.hoursUntilDispatch > 0 ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Until dispatch window
            </dt>
            <dd className="mt-0.5 font-medium text-zinc-900">
              ~{deferredDispatch.hoursUntilDispatch} hour
              {deferredDispatch.hoursUntilDispatch === 1 ? "" : "s"} (
              {deferredDispatch.daysUntilDispatch} day
              {deferredDispatch.daysUntilDispatch === 1 ? "" : "s"})
            </dd>
          </div>
        ) : null}
        {deferredDispatch.hoursOverdue != null && deferredDispatch.hoursOverdue > 0 ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Hours overdue
            </dt>
            <dd className="mt-0.5 font-medium text-amber-900">
              {deferredDispatch.hoursOverdue}
            </dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Ops attention
          </dt>
          <dd className="mt-0.5 font-medium text-zinc-900">
            {deferredDispatch.operationalAttentionRequired ? "Yes — overdue dispatch" : "No"}
          </dd>
        </div>
      </dl>
    </>
  );

  if (embedded) {
    return <div className="text-sm">{body}</div>;
  }

  return (
    <section className={`${ADMIN_DETAIL_CARD_CLASS} ${toneClass} p-4 sm:p-5`}>{body}</section>
  );
}
