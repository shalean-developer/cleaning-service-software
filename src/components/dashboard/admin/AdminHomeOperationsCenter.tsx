import Link from "next/link";
import { AdminCronHealthCriticalBanner } from "@/components/dashboard/AdminCronHealthPanel";
import type { DeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import type { CronHealthSummary } from "@/features/dashboards/adminAssignmentsPageDisplay";
import { queueCountByKey } from "@/features/dashboards/adminHomeDisplay";
import {
  adminHomePanelClass,
  adminHomePanelHeaderClass,
  adminHomePanelTitleClass,
  adminHomeSnapshotCardClass,
  buildAdminHomeDispatchAlerts,
  buildAdminHomeLiveFeed,
  buildAdminHomePayoutSummaryView,
  buildAdminHomeRhythmMetrics,
  buildAdminHomeSupportQueue,
  buildAdminHomeTodaySnapshot,
  buildAdminHomeWorkbenchRows,
  withActiveIssuesCount,
  type AdminHomeDispatchAlert,
  type AdminHomeLiveFeedItem,
  type AdminHomePayoutSummaryView,
  type AdminHomeDisplayContext,
  type AdminHomeRhythmMetric,
  type AdminHomeTodaySnapshot,
  type AdminHomeWorkbenchRow,
} from "@/features/dashboards/adminHomeOperationsDisplay";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import type { AdminOperationalQueueCountItem } from "@/features/dashboards/server/adminOperationalQueueCounts";
import type {
  AdminAssignmentQueueItem,
  AdminBookingListItem,
} from "@/features/dashboards/server/types";
import type { AdminPayoutSummary } from "@/features/earnings/server/payoutReadModel";
import type { CronJobHealthSnapshot } from "@/features/operations/server/cronHealthTypes";
import {
  labelForBookingStatus,
  toneForBookingStatus,
} from "@/features/bookings/server/statusLabels";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

const HOME_ATTENTION_PREVIEW_LIMIT = 5;

type Props = {
  referenceNow: string;
  queues: AdminOperationalQueueCountItem[];
  cronSummary: CronHealthSummary | null;
  criticalCronJobs: CronJobHealthSnapshot[];
  deferredDiagnostics: DeferredAssignmentDiagnostics | null;
  assignmentWorkQueueTotal: number;
  payoutSummary: AdminPayoutSummary | null;
  attention: AdminAssignmentQueueItem[];
  attentionTotal: number;
  bookings: AdminBookingListItem[];
  recentBookings: AdminBookingListItem[];
};

function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-800">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
      </span>
      Live
    </span>
  );
}

function OperationsHero() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-200/60 bg-gradient-to-r from-white via-zinc-50/80 to-zinc-50/40 px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Operations
        </p>
        <h1 className="mt-0.5 text-sm font-semibold tracking-tight text-zinc-900 sm:text-base">
          Today on Shalean
        </h1>
        <p className="mt-0.5 max-w-xl text-[11px] leading-snug text-zinc-600">
          Calm command of bookings, cleaners, dispatch, payouts, and support — at a glance.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <LiveIndicator />
        <Link
          href="/admin/assignments"
          className="inline-flex items-center rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800"
        >
          Open dispatch
        </Link>
      </div>
    </header>
  );
}

type SnapshotCard = {
  id: string;
  label: string;
  value: string;
  hint: string;
  emphasize?: boolean;
};

function SnapshotStrip({
  snapshot,
  queues,
  cronSummary,
  deferredDiagnostics,
}: {
  snapshot: AdminHomeTodaySnapshot;
  queues: readonly AdminOperationalQueueCountItem[];
  cronSummary: CronHealthSummary | null;
  deferredDiagnostics: DeferredAssignmentDiagnostics | null;
}) {
  const matchingPending = queueCountByKey(queues, "needs_assignment");
  const criticalSignals =
    (cronSummary?.criticalCount ?? 0) + (deferredDiagnostics?.overdueDispatchCount ?? 0);

  const cards: SnapshotCard[] = [
    {
      id: "bookings",
      label: "Bookings today",
      value: String(snapshot.bookingsToday),
      hint: `${snapshot.bookingsConfirmed} confirmed · ${snapshot.bookingsDone} done`,
    },
    {
      id: "cleaners",
      label: "Cleaners active",
      value: String(snapshot.cleanersActive),
      hint:
        matchingPending > 0
          ? `${matchingPending} matching pending`
          : "Assigned on today's schedule",
    },
    {
      id: "revenue",
      label: "Revenue today",
      value: formatZar(snapshot.revenueTodayCents),
      hint: "Confirmed & completed slice",
    },
    {
      id: "issues",
      label: "Active issues",
      value: String(snapshot.activeIssues),
      hint:
        snapshot.activeIssues > 0
          ? criticalSignals > 0
            ? `${criticalSignals} critical`
            : "Needs immediate attention"
          : "Queues clear",
      emphasize: snapshot.activeIssues > 0,
    },
  ];

  return (
    <ul className="grid list-none gap-2 p-0 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <li key={card.id}>
          <div className={adminHomeSnapshotCardClass(card.emphasize)}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {card.label}
            </span>
            <span className="mt-0.5 text-xl font-semibold tabular-nums leading-none tracking-tight text-zinc-900">
              {card.value}
            </span>
            <span className="mt-1 text-[11px] leading-snug text-zinc-600">{card.hint}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function feedIconTone(kind: AdminHomeLiveFeedItem["kind"]): string {
  switch (kind) {
    case "assignment":
      return "bg-violet-100 text-violet-700";
    case "confirmed":
      return "bg-emerald-100 text-emerald-700";
    case "support":
      return "bg-sky-100 text-sky-700";
    case "risk":
      return "bg-amber-100 text-amber-800";
    case "completed":
      return "bg-zinc-100 text-zinc-700";
    case "recurring":
      return "bg-indigo-100 text-indigo-700";
    case "payment":
      return "bg-red-100 text-red-700";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

function feedIconGlyph(kind: AdminHomeLiveFeedItem["kind"]): string {
  switch (kind) {
    case "assignment":
      return "◎";
    case "confirmed":
      return "✓";
    case "support":
      return "◆";
    case "risk":
      return "!";
    case "completed":
      return "●";
    case "recurring":
      return "↻";
    case "payment":
      return "$";
    default:
      return "·";
  }
}

function LiveFeedPanel({ items }: { items: AdminHomeLiveFeedItem[] }) {
  return (
    <section className={adminHomePanelClass()} aria-label="Live operations feed">
      <header className={adminHomePanelHeaderClass()}>
        <h2 className={adminHomePanelTitleClass()}>Live operations</h2>
        <LiveIndicator />
      </header>
      {items.length === 0 ? (
        <p className="px-3 py-2.5 text-xs text-zinc-500">No recent operational activity.</p>
      ) : (
        <ul className="max-h-[13.5rem] divide-y divide-zinc-100/90 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group flex items-start gap-2 px-3 py-1.5 transition-colors hover:bg-zinc-50/90"
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold ${feedIconTone(item.kind)}`}
                  aria-hidden
                >
                  {feedIconGlyph(item.kind)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-zinc-900 group-hover:text-zinc-950">
                    {item.title}
                  </span>
                  <span className="block truncate text-[11px] text-zinc-600">{item.detail}</span>
                </span>
                <span className="shrink-0 pt-0.5 text-[10px] tabular-nums text-zinc-400">
                  {item.timeLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function dispatchAlertSurface(severity: AdminHomeDispatchAlert["severity"]): string {
  switch (severity) {
    case "critical":
      return "border-red-200/80 bg-red-50/50";
    case "warning":
      return "border-amber-200/80 bg-amber-50/40";
    default:
      return "border-sky-200/70 bg-sky-50/30";
  }
}

function dispatchBadgeClass(severity: AdminHomeDispatchAlert["severity"]): string {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800";
    case "warning":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-sky-50 text-sky-800";
  }
}

function DispatchAlertsPanel({ alerts }: { alerts: AdminHomeDispatchAlert[] }) {
  return (
    <section className={adminHomePanelClass()} aria-label="Dispatch alerts">
      <header className={adminHomePanelHeaderClass()}>
        <h2 className={adminHomePanelTitleClass()}>Dispatch alerts</h2>
        <Link
          href="/admin/assignments"
          className="text-[11px] font-medium text-zinc-600 transition-colors hover:text-zinc-900"
        >
          Dispatch →
        </Link>
      </header>
      <div className="space-y-1.5 p-2">
        {alerts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-2.5 text-xs text-zinc-500">
            Dispatch queue is clear.
          </p>
        ) : (
          <ul className="list-none space-y-1.5 p-0">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 ${dispatchAlertSurface(alert.severity)}`}
              >
                <div className="min-w-0">
                  <span
                    className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${dispatchBadgeClass(alert.severity)}`}
                  >
                    {alert.severity}
                  </span>
                  <p className="mt-0.5 text-xs font-medium text-zinc-900">{alert.title}</p>
                  <p className="truncate text-[11px] text-zinc-600">{alert.description}</p>
                </div>
                <Link
                  href={alert.href}
                  className="shrink-0 rounded-md border border-zinc-200/80 bg-white/80 px-2 py-1 text-[11px] font-medium text-zinc-800 transition-colors hover:bg-white"
                >
                  {alert.cta}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SupportQueuePanel({
  rows,
}: {
  rows: ReturnType<typeof buildAdminHomeSupportQueue>;
}) {
  return (
    <section className={adminHomePanelClass()} aria-label="Support queue">
      <header className={adminHomePanelHeaderClass()}>
        <h2 className={adminHomePanelTitleClass()}>Support queue</h2>
        <Link
          href="/admin/analytics/team-support"
          className="text-[11px] font-medium text-zinc-600 transition-colors hover:text-zinc-900"
        >
          Insights →
        </Link>
      </header>
      {rows.length === 0 ? (
        <p className="px-3 py-2.5 text-xs text-zinc-500">No open support signals in this slice.</p>
      ) : (
        <ul className="divide-y divide-zinc-100/90">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={row.href}
                className="group flex items-center gap-2 px-3 py-1.5 transition-colors hover:bg-zinc-50/90"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[9px] font-semibold text-zinc-700">
                  {row.customerInitials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium text-zinc-900">{row.title}</span>
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        row.priority === "high"
                          ? "bg-red-500"
                          : row.priority === "medium"
                            ? "bg-amber-400"
                            : "bg-zinc-300"
                      }`}
                      aria-hidden
                    />
                  </span>
                  <span className="block truncate text-[11px] text-zinc-600">{row.detail}</span>
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">
                  {row.timeLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RhythmPanel({ metrics }: { metrics: AdminHomeRhythmMetric[] }) {
  return (
    <section
      className="rounded-2xl border border-zinc-200/60 bg-zinc-50/30 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
      aria-label="Operational rhythm"
    >
      <header className="px-3 py-1.5">
        <h2 className={adminHomePanelTitleClass()}>Operational rhythm</h2>
      </header>
      <ul className="grid list-none grid-cols-2 gap-2 p-2 pt-0 sm:grid-cols-4">
        {metrics.map((metric) => (
          <li
            key={metric.id}
            className="rounded-xl border border-zinc-200/50 bg-white/70 px-2.5 py-2"
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {metric.label}
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-800">
              {metric.value}
            </p>
            {metric.hint ? (
              <p className="text-[10px] leading-snug text-zinc-500">{metric.hint}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function NeedsAttentionPanel({
  rows,
  attentionTotal,
}: {
  rows: AdminHomeWorkbenchRow[];
  attentionTotal: number;
}) {
  return (
    <section className={adminHomePanelClass()} aria-label="Needs attention">
      <header className={adminHomePanelHeaderClass()}>
        <h2 className={adminHomePanelTitleClass()}>Needs attention</h2>
        <Link
          href="/admin/assignments"
          className="text-[11px] font-medium text-zinc-600 transition-colors hover:text-zinc-900"
        >
          View all ({attentionTotal}) →
        </Link>
      </header>
      {rows.length === 0 ? (
        <p className="px-3 py-2.5 text-xs text-zinc-500">No urgent items right now.</p>
      ) : (
        <ul className="divide-y divide-zinc-100/90">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-2 px-3 py-1.5">
              <div className="min-w-0">
                <p
                  className={`text-[10px] font-semibold uppercase tracking-wide ${
                    row.tone === "danger" ? "text-red-700" : "text-amber-800"
                  }`}
                >
                  {row.issueType}
                </p>
                <p className="truncate text-xs font-medium text-zinc-900">{row.title}</p>
                <p className="truncate text-[11px] text-zinc-600">{row.meta}</p>
                <p className="text-[10px] text-zinc-400">{row.timeLabel}</p>
              </div>
              <Link
                href={row.href}
                className="shrink-0 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
              >
                {row.cta}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentBookingsPanel({ bookings }: { bookings: AdminBookingListItem[] }) {
  return (
    <section className={adminHomePanelClass()} aria-label="Recent bookings">
      <header className={adminHomePanelHeaderClass()}>
        <h2 className={adminHomePanelTitleClass()}>Recent bookings</h2>
        <Link
          href="/admin/bookings"
          className="text-[11px] font-medium text-zinc-600 transition-colors hover:text-zinc-900"
        >
          View all →
        </Link>
      </header>
      {bookings.length === 0 ? (
        <p className="px-3 py-2.5 text-xs text-zinc-500">No bookings yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-100/90">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <Link
                href={`/admin/bookings/${booking.id}`}
                className="group flex items-center justify-between gap-2 px-3 py-1.5 transition-colors hover:bg-zinc-50/90"
              >
                <div className="min-w-0">
                  <StatusBadge
                    label={labelForBookingStatus(booking.status)}
                    tone={toneForBookingStatus(booking.status)}
                  />
                  <p className="mt-0.5 truncate text-xs font-medium text-zinc-900">
                    {booking.serviceLabel}
                  </p>
                  <p className="truncate text-[11px] text-zinc-600">
                    {booking.customerLabel}
                    {booking.cleanerLabel ? ` · ${booking.cleanerLabel}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
                  {booking.scheduleLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PayoutQueuePanel({ payout }: { payout: AdminHomePayoutSummaryView }) {
  const hasReady = payout.payoutReadyCount > 0;

  return (
    <section
      className="rounded-2xl border border-zinc-200/70 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
      aria-label="Payout queue"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Payout queue
          </p>
          <p className="mt-0.5 text-sm font-semibold text-white">
            {hasReady ? "Weekly payouts ready" : "Payout-ready bookings"}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-300">
            {hasReady ? (
              <>
                <span className="font-medium text-white">{payout.payoutReadyLabel}</span> booking
                {payout.payoutReadyCount === 1 ? "" : "s"}
                {" · "}
                {payout.weeklyReadyLabel}
              </>
            ) : (
              payout.weeklyReadyLabel
            )}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-400">
            Pending review: {formatZar(payout.pendingReviewCents)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={payout.previewHref}
            className="inline-flex min-h-8 items-center justify-center rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-900 transition-colors hover:bg-zinc-100"
          >
            Release now
          </Link>
          <Link
            href="/admin/payouts"
            className="inline-flex min-h-8 items-center justify-center rounded-lg border border-zinc-600 px-2.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-white/10"
          >
            Open earnings
          </Link>
        </div>
      </div>
    </section>
  );
}

function StatusBanners({
  criticalCronJobs,
  deferredOverdue,
}: {
  criticalCronJobs: CronJobHealthSnapshot[];
  deferredOverdue: number;
}) {
  return (
    <>
      {criticalCronJobs.length > 0 ? (
        <AdminCronHealthCriticalBanner jobs={criticalCronJobs} />
      ) : null}
      {deferredOverdue > 0 ? (
        <p
          className="rounded-xl border border-amber-200/90 bg-amber-50/80 px-3 py-1.5 text-xs text-amber-950"
          role="status"
        >
          <span className="font-semibold">{deferredOverdue} deferred dispatch overdue</span>
          {" — "}
          <Link
            href="/admin/assignments"
            className="font-medium underline underline-offset-2 hover:text-amber-900"
          >
            Open assignments diagnostics
          </Link>
        </p>
      ) : null}
    </>
  );
}

export function AdminHomeOperationsCenter({
  referenceNow,
  queues,
  cronSummary,
  criticalCronJobs,
  deferredDiagnostics,
  assignmentWorkQueueTotal,
  payoutSummary,
  attention,
  attentionTotal,
  bookings,
  recentBookings,
}: Props) {
  const displayContext: AdminHomeDisplayContext = { referenceNow };
  const snapshot = withActiveIssuesCount(buildAdminHomeTodaySnapshot(bookings, displayContext), {
    queues,
    cronSummary,
    deferredDiagnostics,
  });
  const workbenchRows = buildAdminHomeWorkbenchRows(
    attention,
    queues,
    HOME_ATTENTION_PREVIEW_LIMIT,
    displayContext,
  );
  const liveFeed = buildAdminHomeLiveFeed({ attention, bookings, context: displayContext });
  const dispatchAlerts = buildAdminHomeDispatchAlerts({
    queues,
    attention,
    deferredDiagnostics,
  });
  const supportRows = buildAdminHomeSupportQueue(bookings, 5, displayContext);
  const rhythm = buildAdminHomeRhythmMetrics(
    {
      bookings,
      queues,
      assignmentWorkQueueTotal,
    },
    displayContext,
  );
  const payoutView = buildAdminHomePayoutSummaryView(payoutSummary);
  const deferredOverdue = deferredDiagnostics?.overdueDispatchCount ?? 0;

  return (
    <div className="space-y-2.5" aria-label="Operations command center">
      <StatusBanners
        criticalCronJobs={criticalCronJobs}
        deferredOverdue={deferredOverdue}
      />

      <OperationsHero />

      <SnapshotStrip
        snapshot={snapshot}
        queues={queues}
        cronSummary={cronSummary}
        deferredDiagnostics={deferredDiagnostics}
      />

      <div className="grid gap-2.5 lg:grid-cols-2">
        <LiveFeedPanel items={liveFeed} />
        <DispatchAlertsPanel alerts={dispatchAlerts} />
      </div>

      <SupportQueuePanel rows={supportRows} />

      <RhythmPanel metrics={rhythm} />

      <NeedsAttentionPanel rows={workbenchRows} attentionTotal={attentionTotal} />

      <div className="grid gap-2.5 lg:grid-cols-2">
        <RecentBookingsPanel bookings={recentBookings} />
        <PayoutQueuePanel payout={payoutView} />
      </div>
    </div>
  );
}
