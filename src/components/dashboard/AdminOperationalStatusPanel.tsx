import type { AdminOperationalStatus } from "@/features/dashboards/server/types";
import { AdminManualDispatchAction } from "./AdminManualDispatchAction";
import { AdminReplaceOpenOfferAction } from "./AdminReplaceOpenOfferAction";
import { AdminRecoverAssignmentAction } from "./AdminRecoverAssignmentAction";
import { AdminRunbookRef } from "./AdminRunbookRef";

type Props = {
  bookingId: string;
  operational: AdminOperationalStatus;
};

export function AdminOperationalStatusPanel({ bookingId, operational }: Props) {
  return (
    <section className="mt-6 rounded-xl border border-sky-200 bg-sky-50/50 p-6">
      <h2 className="text-sm font-semibold text-sky-950">Operational status</h2>
      <p className="mt-1 text-xs text-sky-800/80">
        Guidance, recovery, and manual dispatch offers for this booking. No direct assignment or
        status override.
      </p>

      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <section>
          <dt className="text-zinc-500">Payment</dt>
          <dd className="font-medium text-zinc-900">{operational.paymentState}</dd>
        </section>
        <section>
          <dt className="text-zinc-500">Assignment</dt>
          <dd className="font-medium text-zinc-900">{operational.assignmentState}</dd>
        </section>
        <section>
          <dt className="text-zinc-500">Recovery eligibility</dt>
          <dd className="font-medium text-zinc-900">
            {operational.recoveryEligibility === "eligible"
              ? "Eligible for assignment recovery cron"
              : operational.recoveryEligibility === "grace_period"
                ? `Grace period — wait ~${operational.recoveryGraceMinutesRemaining ?? "?"} min`
                : operational.recoveryEligibility === "in_progress"
                  ? "Dispatch in progress"
                  : "Not applicable"}
          </dd>
        </section>
        <section>
          <dt className="text-zinc-500">Open offers</dt>
          <dd className="font-medium text-zinc-900">{operational.openOfferSummary}</dd>
        </section>
        {operational.lastOfferOutcome ? (
          <section>
            <dt className="text-zinc-500">Last offer outcome</dt>
            <dd className="font-medium text-zinc-900">{operational.lastOfferOutcome}</dd>
          </section>
        ) : null}
        <section className="sm:col-span-2">
          <dt className="text-zinc-500">Suggested next step</dt>
          <dd className="font-medium text-zinc-900">{operational.nextSuggestedAction}</dd>
        </section>
      </dl>

      <ul className="mt-4 space-y-1 text-xs text-zinc-700">
        <li>
          {operational.opsSearching
            ? "System is still searching / awaiting offer response."
            : "System is not actively searching."}
        </li>
        <li>
          {operational.opsAdminRequired
            ? "Admin review may be required."
            : "No admin review flag on assignment metadata."}
        </li>
        <li>
          {operational.recoveryCronCanHandle
            ? "Recovery cron can attempt post-payment dispatch for this case."
            : "Recovery cron is not the primary fix for this state."}
        </li>
        <li>
          {operational.manualInterventionNeeded
            ? operational.replaceOfferEligible
              ? "Replace open offer available below."
              : operational.manualDispatchEligible
                ? "Manual dispatch available below."
                : "Manual intervention likely needed — wait for open offers to close or use recovery if dispatch not started."
            : operational.replaceOfferEligible
              ? "Replace open offer available below."
              : "No manual intervention flag."}
        </li>
      </ul>

      {operational.runbookKey ? (
        <AdminRunbookRef runbookKey={operational.runbookKey} className="mt-4" />
      ) : null}

      <AdminRecoverAssignmentAction
        bookingId={bookingId}
        recoveryEligibility={operational.recoveryEligibility}
      />

      <AdminReplaceOpenOfferAction bookingId={bookingId} operational={operational} />

      <AdminManualDispatchAction bookingId={bookingId} operational={operational} />
    </section>
  );
}
