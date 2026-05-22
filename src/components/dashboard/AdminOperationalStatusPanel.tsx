import type { AdminOperationalStatus } from "@/features/dashboards/server/types";
import {
  ADMIN_DETAIL_CARD_CLASS,
  ADMIN_DETAIL_INSET_CLASS,
  ADMIN_SECTION_MUTED_CLASS,
  ADMIN_SECTION_TITLE_CLASS,
} from "@/features/dashboards/adminDisplay";
import { AdminManualDispatchAction } from "./AdminManualDispatchAction";
import { AdminReplaceOpenOfferAction } from "./AdminReplaceOpenOfferAction";
import { AdminDispatchDeferredNowAction } from "./AdminDispatchDeferredNowAction";
import { AdminRecoverAssignmentAction } from "./AdminRecoverAssignmentAction";
import { AdminRunbookRef } from "./AdminRunbookRef";

type Props = {
  bookingId: string;
  operational: AdminOperationalStatus;
};

export function AdminOperationalStatusPanel({ bookingId, operational }: Props) {
  return (
    <section className={`${ADMIN_DETAIL_CARD_CLASS} border-sky-200/80 bg-sky-50/30 p-4 sm:p-5`}>
      <h2 className={`${ADMIN_SECTION_TITLE_CLASS} text-sky-950`}>Actions</h2>
      <p className={ADMIN_SECTION_MUTED_CLASS}>
        Manual ops. booking statuses are not overridden here.
      </p>

      <section className="mt-3 space-y-2">
        <AdminDispatchDeferredNowAction
          bookingId={bookingId}
          deferredDispatchNowEligible={operational.deferredDispatchNowEligible}
        />
        <AdminRecoverAssignmentAction
          bookingId={bookingId}
          recoveryEligibility={operational.recoveryEligibility}
        />
        <AdminReplaceOpenOfferAction bookingId={bookingId} operational={operational} />
        <AdminManualDispatchAction bookingId={bookingId} operational={operational} />
      </section>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium text-zinc-600 hover:text-zinc-900">
          Status breakdown
        </summary>
        <dl className="mt-2 grid gap-2.5 sm:grid-cols-2 sm:gap-x-5">
          <section>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Payment</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">{operational.paymentState}</dd>
          </section>
          <section>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Assignment
            </dt>
            <dd className="mt-0.5 font-medium text-zinc-900">{operational.assignmentState}</dd>
          </section>
          <section>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Recovery</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">
              {operational.recoveryEligibility === "eligible"
                ? "Eligible for recovery cron"
                : operational.recoveryEligibility === "grace_period"
                  ? `Grace. ~${operational.recoveryGraceMinutesRemaining ?? "?"} min`
                  : operational.recoveryEligibility === "in_progress"
                    ? "Dispatch in progress"
                    : "N/A"}
            </dd>
          </section>
          <section>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Open offers
            </dt>
            <dd className="mt-0.5 font-medium text-zinc-900">{operational.openOfferSummary}</dd>
          </section>
          {operational.lastOfferOutcome ? (
            <section>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Last outcome
              </dt>
              <dd className="mt-0.5 font-medium text-zinc-900">{operational.lastOfferOutcome}</dd>
            </section>
          ) : null}
        </dl>

        <ul
          className={`mt-2 space-y-0.5 ${ADMIN_DETAIL_INSET_CLASS} px-3 py-2 text-xs text-zinc-700`}
        >
          <li>{operational.opsSearching ? "Searching: active" : "Searching: idle"}</li>
          <li>
            {operational.opsAdminRequired
              ? "Admin review: flagged"
              : "Admin review: not flagged"}
          </li>
          <li>
            {operational.recoveryCronCanHandle
              ? "Recovery cron: can handle"
              : "Recovery cron: not primary"}
          </li>
          <li>
            {operational.manualInterventionNeeded
              ? operational.replaceOfferEligible
                ? "Intervention: replace offer above"
                : operational.manualDispatchEligible
                  ? "Intervention: manual dispatch above"
                  : "Intervention: wait or use recovery"
              : operational.replaceOfferEligible
                ? "Intervention: replace offer above"
                : "Intervention: not flagged"}
          </li>
        </ul>

        {operational.runbookKey ? (
          <AdminRunbookRef runbookKey={operational.runbookKey} className="mt-2" />
        ) : null}
      </details>
    </section>
  );
}
