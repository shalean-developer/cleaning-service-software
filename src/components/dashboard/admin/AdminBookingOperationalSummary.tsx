import type { AdminOperationalStatus } from "@/features/dashboards/server/types";
import {
  ADMIN_DETAIL_CARD_CLASS,
  ADMIN_SECTION_MUTED_CLASS,
} from "@/features/dashboards/adminDisplay";
import { adminBookingOperationalScanLine } from "@/features/dashboards/adminBookingDetailDisplay";

type Props = {
  operational: AdminOperationalStatus;
  attentionFlags: {
    paymentFailed: boolean;
    deferredAttention: boolean;
    teamSupportFollowUp: boolean;
    earningsAttention: boolean;
  };
};

export function AdminBookingOperationalSummary({
  operational,
  attentionFlags,
}: Props) {
  const needsAttention =
    attentionFlags.paymentFailed ||
    attentionFlags.deferredAttention ||
    attentionFlags.teamSupportFollowUp ||
    attentionFlags.earningsAttention ||
    operational.manualInterventionNeeded ||
    operational.opsAdminRequired;

  return (
    <section
      className={`${ADMIN_DETAIL_CARD_CLASS} border px-4 py-3 sm:px-5 ${
        needsAttention ? "border-amber-300/80 bg-amber-50/40" : "border-zinc-200 bg-zinc-50/50"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
        Ops scan
      </p>
      <p className="mt-1 text-sm font-medium leading-snug text-zinc-900">
        {adminBookingOperationalScanLine(operational)}
      </p>
      <p className={`${ADMIN_SECTION_MUTED_CLASS} mt-1.5 text-sm font-medium text-zinc-800`}>
        Next: {operational.nextSuggestedAction}
      </p>
      {needsAttention ? (
        <ul className="mt-2 flex flex-wrap gap-1.5 text-xs font-medium">
          {attentionFlags.paymentFailed ? (
            <li className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-950 ring-1 ring-amber-200">
              Payment issue
            </li>
          ) : null}
          {attentionFlags.deferredAttention ? (
            <li className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-950 ring-1 ring-amber-200">
              Deferred dispatch
            </li>
          ) : null}
          {attentionFlags.teamSupportFollowUp ? (
            <li className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-950 ring-1 ring-violet-200">
              Team support follow-up
            </li>
          ) : null}
          {attentionFlags.earningsAttention ? (
            <li className="rounded-full bg-red-100 px-2 py-0.5 text-red-900 ring-1 ring-red-200">
              Earnings blocked
            </li>
          ) : null}
          {operational.manualInterventionNeeded ? (
            <li className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-950 ring-1 ring-amber-200">
              Manual intervention
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}
