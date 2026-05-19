import type { DeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import type { CronHealthSummary } from "@/features/dashboards/adminAssignmentsPageDisplay";
import type { AdminOperationalQueueCountItem } from "@/features/dashboards/server/adminOperationalQueueCounts";
import type { AdminOperationalQueueKey } from "@/features/dashboards/adminOperationalQueues";

export type AdminHomeHealthTileTone = "neutral" | "info" | "warning" | "danger" | "success";

export type AdminHomeHealthTile = {
  id: string;
  label: string;
  value: string;
  subtitle?: string;
  href: string;
  cta: string;
  tone: AdminHomeHealthTileTone;
  /** When true, use stronger border/background even at zero. */
  emphasize?: boolean;
};

export function queueCountByKey(
  queues: readonly AdminOperationalQueueCountItem[],
  key: AdminOperationalQueueKey,
): number {
  return queues.find((q) => q.key === key)?.count ?? 0;
}

/** Composite “needs eyes now” — payment failures plus cron/deferred signals (presentation only). */
export function computeAdminHomeUrgentCount(input: {
  queues: readonly AdminOperationalQueueCountItem[];
  cronSummary: CronHealthSummary | null;
  deferredDiagnostics: DeferredAssignmentDiagnostics | null;
}): number {
  const payment = queueCountByKey(input.queues, "payment_attention");
  const cronCritical = input.cronSummary?.criticalCount ?? 0;
  const deferredOverdue = input.deferredDiagnostics?.overdueDispatchCount ?? 0;
  return payment + cronCritical + deferredOverdue;
}

export function buildAdminHomeHealthTiles(input: {
  queues: readonly AdminOperationalQueueCountItem[];
  cronSummary: CronHealthSummary | null;
  deferredDiagnostics: DeferredAssignmentDiagnostics | null;
  assignmentWorkQueueTotal: number;
  payoutQueueCount: number | null;
}): AdminHomeHealthTile[] {
  const paymentCount = queueCountByKey(input.queues, "payment_attention");
  const assignmentCount = queueCountByKey(input.queues, "assignment_attention");
  const urgentCount = computeAdminHomeUrgentCount({
    queues: input.queues,
    cronSummary: input.cronSummary,
    deferredDiagnostics: input.deferredDiagnostics,
  });
  const deferredOverdue = input.deferredDiagnostics?.overdueDispatchCount ?? 0;

  const cronTile = buildCronHealthTile(input.cronSummary);
  const payoutTile = buildPayoutTile(input.payoutQueueCount);

  const urgentSubtitle =
    deferredOverdue > 0 && (input.cronSummary?.criticalCount ?? 0) > 0
      ? `Includes ${paymentCount} payment${paymentCount === 1 ? "" : "s"}, cron, deferred`
      : deferredOverdue > 0
        ? `Includes ${deferredOverdue} deferred overdue`
        : (input.cronSummary?.criticalCount ?? 0) > 0
          ? `Includes ${input.cronSummary!.criticalCount} critical cron`
          : paymentCount > 0
            ? "Payment failed bookings"
            : undefined;

  return [
    {
      id: "urgent",
      label: "Urgent",
      value: String(urgentCount),
      subtitle: urgentSubtitle,
      href:
        paymentCount > 0
          ? "/admin/bookings?filter=payment_failed"
          : "/admin/assignments",
      cta: paymentCount > 0 ? "Payment queue" : "Assignments",
      tone: urgentCount > 0 ? "danger" : "success",
      emphasize: urgentCount > 0,
    },
    {
      id: "assignments",
      label: "Assignment attention",
      value: String(assignmentCount),
      subtitle:
        input.assignmentWorkQueueTotal > 0
          ? `${input.assignmentWorkQueueTotal} in work queue`
          : "Global filter count",
      href: "/admin/assignments",
      cta: "Open workbench",
      tone: assignmentCount > 0 ? "warning" : "neutral",
      emphasize: assignmentCount > 0,
    },
    {
      id: "payments",
      label: "Payment issues",
      value: String(paymentCount),
      href: "/admin/bookings?filter=payment_failed",
      cta: "View bookings",
      tone: paymentCount > 0 ? "danger" : "neutral",
      emphasize: paymentCount > 0,
    },
    cronTile,
    payoutTile,
  ];
}

function buildCronHealthTile(cronSummary: CronHealthSummary | null): AdminHomeHealthTile {
  if (!cronSummary) {
    return {
      id: "cron",
      label: "Cron health",
      value: "—",
      subtitle: "Unavailable",
      href: "/admin/assignments",
      cta: "Diagnostics",
      tone: "neutral",
    };
  }

  const { worstLevel, criticalCount, warningCount } = cronSummary;
  if (worstLevel === "critical") {
    return {
      id: "cron",
      label: "Cron health",
      value: `${criticalCount} critical`,
      href: "/admin/assignments",
      cta: "Diagnostics",
      tone: "danger",
      emphasize: true,
    };
  }
  if (worstLevel === "warning") {
    return {
      id: "cron",
      label: "Cron health",
      value: `${warningCount} warning`,
      href: "/admin/assignments",
      cta: "Diagnostics",
      tone: "warning",
      emphasize: true,
    };
  }

  return {
    id: "cron",
    label: "Cron health",
    value: "Healthy",
    href: "/admin/assignments",
    cta: "Diagnostics",
    tone: "success",
  };
}

function buildPayoutTile(payoutQueueCount: number | null): AdminHomeHealthTile {
  if (payoutQueueCount == null) {
    return {
      id: "payouts",
      label: "Payouts",
      value: "—",
      subtitle: "Unavailable",
      href: "/admin/payouts",
      cta: "Payouts",
      tone: "neutral",
    };
  }

  return {
    id: "payouts",
    label: "Payout-ready",
    value: String(payoutQueueCount),
    subtitle: payoutQueueCount === 0 ? "Nothing awaiting payout" : "Bookings in payout queue",
    href: "/admin/payouts",
    cta: "Open payouts",
    tone: payoutQueueCount > 0 ? "info" : "neutral",
    emphasize: payoutQueueCount > 0,
  };
}

export function adminHomeHealthTileClass(tone: AdminHomeHealthTileTone, emphasize: boolean): string {
  const base =
    "flex min-h-[5.25rem] flex-col rounded-xl border px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2";
  if (!emphasize && tone === "neutral") {
    return `${base} border-zinc-200/80 bg-white hover:border-zinc-300`;
  }
  if (!emphasize && tone === "success") {
    return `${base} border-emerald-200/80 bg-emerald-50/30 hover:border-emerald-300`;
  }
  switch (tone) {
    case "danger":
      return `${base} border-red-200 bg-red-50/90 hover:border-red-300`;
    case "warning":
      return `${base} border-amber-200 bg-amber-50/80 hover:border-amber-300`;
    case "info":
      return `${base} border-sky-200 bg-sky-50/80 hover:border-sky-300`;
    case "success":
      return `${base} border-emerald-200/80 bg-emerald-50/40 hover:border-emerald-300`;
    default:
      return `${base} border-zinc-200/80 bg-white hover:border-zinc-300`;
  }
}
