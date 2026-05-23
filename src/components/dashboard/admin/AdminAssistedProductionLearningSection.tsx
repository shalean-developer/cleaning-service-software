"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { AdminAssistedProductionLearning } from "@/features/bookings/server/admin/loadAdminAssistedProductionLearning";
import type { AdminAssistedIncidentReviewStatus } from "@/features/bookings/server/admin/adminAssistedIncidentReviewTypes";
import { ADMIN_ASSISTED_LESSON_CATEGORY_LABELS } from "@/features/bookings/server/admin/adminAssistedOperatorLessonTypes";

type Props = {
  learning: AdminAssistedProductionLearning;
};

const REVIEW_STATUSES: AdminAssistedIncidentReviewStatus[] = [
  "open",
  "investigating",
  "resolved",
  "dismissed",
];

const DECISION_STYLES: Record<string, string> = {
  continue_pilot: "border-emerald-200 bg-emerald-50 text-emerald-950",
  expand_payment_links: "border-sky-200 bg-sky-50 text-sky-950",
  enable_eft: "border-sky-200 bg-sky-50 text-sky-950",
  hold_rollout: "border-amber-200 bg-amber-50 text-amber-950",
  rollback: "border-red-200 bg-red-50 text-red-950",
};

function IncidentReviewForm({
  incidentKey,
  initialStatus,
}: {
  incidentKey: string;
  initialStatus: AdminAssistedIncidentReviewStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<AdminAssistedIncidentReviewStatus>(initialStatus);
  const [rootCauseNotes, setRootCauseNotes] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [followUpAction, setFollowUpAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/bookings/assist-incidents/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentKey,
          status,
          rootCauseNotes: rootCauseNotes.trim() || null,
          resolutionNotes: resolutionNotes.trim() || null,
          followUpAction: followUpAction.trim() || null,
        }),
      });
      const json = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !json.ok) {
        setError(json.message ?? "Could not save review.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not save review.");
    } finally {
      setSaving(false);
    }
  }, [followUpAction, incidentKey, resolutionNotes, rootCauseNotes, router, status]);

  return (
    <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
      <div className="flex flex-wrap gap-2">
        <label className="text-xs text-zinc-600">
          Review status
          <select
            className="ml-2 rounded border border-zinc-200 px-2 py-1 text-xs"
            value={status}
            onChange={(e) => setStatus(e.target.value as AdminAssistedIncidentReviewStatus)}
            data-testid={`incident-review-status-${incidentKey}`}
          >
            {REVIEW_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <textarea
        className="w-full rounded border border-zinc-200 px-2 py-1 text-xs"
        rows={2}
        placeholder="Root cause notes"
        value={rootCauseNotes}
        onChange={(e) => setRootCauseNotes(e.target.value)}
      />
      <textarea
        className="w-full rounded border border-zinc-200 px-2 py-1 text-xs"
        rows={2}
        placeholder="Resolution notes"
        value={resolutionNotes}
        onChange={(e) => setResolutionNotes(e.target.value)}
      />
      <textarea
        className="w-full rounded border border-zinc-200 px-2 py-1 text-xs"
        rows={2}
        placeholder="Follow-up action"
        value={followUpAction}
        onChange={(e) => setFollowUpAction(e.target.value)}
      />
      <button
        type="button"
        disabled={saving}
        onClick={() => void onSave()}
        className="rounded bg-zinc-800 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save review"}
      </button>
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-2">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

export function AdminAssistedProductionLearningSection({ learning }: Props) {
  const { weeklyReview, incidentsWithReview, operatorLessons, improvementBacklog, rolloutDecision } =
    learning;
  const decisionStyle =
    DECISION_STYLES[rolloutDecision.decision] ?? "border-zinc-200 bg-zinc-50 text-zinc-900";

  const openIncidents = incidentsWithReview.filter(
    (item) => item.reviewStatus !== "resolved" && item.reviewStatus !== "dismissed",
  );

  return (
    <section
      className="space-y-6 rounded-xl border border-violet-200 bg-violet-50/30 p-4"
      data-testid="admin-assisted-production-learning"
    >
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Production learning</h2>
        <p className="text-sm text-zinc-600">
          Incident reviews, operator lessons, weekly summary, and advisory rollout guidance.
        </p>
      </div>

      <section
        className={`rounded-xl border p-4 ${decisionStyle}`}
        data-testid="admin-assisted-rollout-decision"
      >
        <p className="text-xs font-medium uppercase tracking-wide opacity-80">Rollout recommendation (advisory)</p>
        <p className="text-lg font-semibold">{rolloutDecision.label}</p>
        <p className="mt-1 text-sm">{rolloutDecision.rationale}</p>
      </section>

      <section
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        data-testid="admin-assisted-weekly-review"
      >
        <h3 className="text-base font-semibold text-zinc-900">Weekly rollout review</h3>
        <p className="text-xs text-zinc-500">{weeklyReview.periodLabel}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Health score" value={`${weeklyReview.healthScore} (${weeklyReview.healthBand})`} />
          <Metric label="Trend" value={weeklyReview.healthScoreTrend} />
          <Metric label="Bookings created" value={weeklyReview.bookingsCreated} />
          <Metric
            label="Conversion rate"
            value={
              weeklyReview.conversionRate != null
                ? `${Math.round(weeklyReview.conversionRate * 100)}%`
                : "—"
            }
          />
          <Metric
            label="Payment success"
            value={
              weeklyReview.paymentSuccessRate != null
                ? `${Math.round(weeklyReview.paymentSuccessRate * 100)}%`
                : "—"
            }
          />
          <Metric
            label="Assignment success"
            value={
              weeklyReview.assignmentSuccessRate != null
                ? `${Math.round(weeklyReview.assignmentSuccessRate * 100)}%`
                : "—"
            }
          />
          <Metric
            label="Recurring success"
            value={
              weeklyReview.recurringSuccessRate != null
                ? `${Math.round(weeklyReview.recurringSuccessRate * 100)}%`
                : "—"
            }
          />
          <Metric label="Failed notifications" value={weeklyReview.failedNotifications} />
          <Metric label="Unresolved incidents" value={weeklyReview.unresolvedIncidents} />
        </div>
        {weeklyReview.operatorFeedbackHighlights.length > 0 ? (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-zinc-700">
            {weeklyReview.operatorFeedbackHighlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        data-testid="admin-assisted-incident-review-queue"
      >
        <h3 className="text-base font-semibold text-zinc-900">Incident review queue</h3>
        <p className="text-sm text-zinc-600">Human review only — incidents are never auto-resolved.</p>
        {openIncidents.length === 0 ? (
          <p className="mt-3 text-sm text-emerald-800">No open incidents requiring review.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {openIncidents.slice(0, 10).map((incident) => (
              <li key={incident.id} className="rounded-lg border border-zinc-100 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/bookings/${incident.bookingId}`}
                    className="font-medium text-sky-700 underline-offset-2 hover:underline"
                  >
                    {incident.customerLabel}
                  </Link>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase">
                    {incident.severity}
                  </span>
                  <span className="text-xs text-zinc-500">Review: {incident.reviewStatus}</span>
                </div>
                <p className="mt-1 font-medium">{incident.title}</p>
                <IncidentReviewForm incidentKey={incident.id} initialStatus={incident.reviewStatus} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        data-testid="admin-assisted-operator-lessons"
      >
        <h3 className="text-base font-semibold text-zinc-900">Operator lessons</h3>
        {operatorLessons.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No lessons captured yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {operatorLessons.slice(0, 15).map((lesson) => (
              <li key={lesson.id} className="rounded-lg border border-zinc-100 px-3 py-2">
                <p className="font-medium">{lesson.summary}</p>
                <p className="text-xs text-zinc-500">
                  {lesson.category
                    ? ADMIN_ASSISTED_LESSON_CATEGORY_LABELS[lesson.category]
                    : "Uncategorized"}
                  {lesson.tags.length > 0 ? ` · ${lesson.tags.join(", ")}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        data-testid="admin-assisted-improvement-backlog"
      >
        <h3 className="text-base font-semibold text-zinc-900">Improvement backlog (generated)</h3>
        {improvementBacklog.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No backlog items from current signals.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {improvementBacklog.slice(0, 12).map((item) => (
              <li key={item.id} className="rounded-lg border border-zinc-100 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.title}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] uppercase">
                    {item.severity}
                  </span>
                  <span className="text-xs text-zinc-500">×{item.frequency}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-600">{item.recommendedAction}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-wrap gap-2 text-sm">
        <a
          href="/api/admin/bookings/assist-production/learning-export?export=weekly&format=csv"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-medium hover:bg-zinc-50"
          data-testid="admin-assisted-learning-export-weekly-csv"
        >
          Weekly review CSV
        </a>
        <a
          href="/api/admin/bookings/assist-production/learning-export?export=incidents&format=csv"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-medium hover:bg-zinc-50"
        >
          Incidents CSV
        </a>
        <a
          href="/api/admin/bookings/assist-production/learning-export?export=lessons&format=csv"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-medium hover:bg-zinc-50"
        >
          Lessons CSV
        </a>
        <a
          href="/api/admin/bookings/assist-production/learning-export?export=backlog&format=csv"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-medium hover:bg-zinc-50"
        >
          Backlog CSV
        </a>
      </section>
    </section>
  );
}
