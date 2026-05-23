"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  executeMonthlyGovernanceBulkAction,
  grantMonthlyAccountTemporaryOverride,
  updateMonthlyAccountCreditLimit,
  updateMonthlyAccountFinanceReview,
  updateMonthlyAccountGovernanceState,
} from "@/features/monthly-billing/api";
import type { MonthlyGovernanceDashboard } from "@/features/monthly-billing/server/loadMonthlyGovernanceDashboard";
import { computeOverrideExpiryInfo } from "@/features/monthly-billing/server/computeOverrideExpiryInfo";
import {
  creditLimitReviewHint,
  formatFinanceReviewStatusLabel,
  formatGovernanceStateLabel,
  formatMonthlyGovernanceZar,
  formatRiskRecommendationLabel,
} from "@/features/monthly-billing/server/formatGovernanceDisplayLabels";
import { AdminMonthlyGovernanceTimeline } from "./AdminMonthlyGovernanceTimeline";
import type { MonthlyGovernanceTimelineEvent } from "@/features/monthly-billing/monthlyAccountGovernanceTypes";

type Props = {
  dashboard: MonthlyGovernanceDashboard;
  timelinesByCustomerId?: Record<string, MonthlyGovernanceTimelineEvent[]>;
};

type CustomerRow = MonthlyGovernanceDashboard["customers"][number];
type SortKey = "exposure" | "overdue" | "lastReview" | "riskScore" | "name";

function CreditUtilizationBar({ customer }: { customer: CustomerRow }) {
  const percent = customer.exposure.exposurePercent;
  const hint = creditLimitReviewHint({
    creditLimitCents: customer.creditLimitCents,
    exposurePercent: percent,
    exposureBand: customer.exposure.exposureBand,
    overdueInvoiceCount: customer.overdueInvoiceCount,
  });

  if (customer.creditLimitCents == null) {
    return (
      <p className="text-xs text-amber-800" data-testid="monthly-governance-missing-limit">
        No credit limit set — exposure tracking is advisory only.
      </p>
    );
  }

  const width = percent != null ? Math.min(percent, 120) : 0;
  const barColor =
    customer.exposure.exposureBand === "exceeded"
      ? "bg-red-500"
      : customer.exposure.exposureBand === "elevated"
        ? "bg-amber-500"
        : customer.exposure.exposureBand === "warning"
          ? "bg-yellow-400"
          : "bg-emerald-500";

  return (
    <div className="mt-2 space-y-1" data-testid="monthly-governance-credit-utilization">
      <div className="flex justify-between text-xs text-zinc-600">
        <span>Credit utilization</span>
        <span>{percent != null ? `${percent}%` : "—"} of {formatMonthlyGovernanceZar(customer.creditLimitCents)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full ${barColor}`} style={{ width: `${width}%` }} />
      </div>
      {hint ? <p className="text-xs text-amber-800">{hint}</p> : null}
    </div>
  );
}

function GovernanceCustomerCard({
  customer,
  timeline,
  selected,
  onToggleSelect,
}: {
  customer: CustomerRow;
  timeline?: MonthlyGovernanceTimelineEvent[];
  selected: boolean;
  onToggleSelect: (customerId: string) => void;
}) {
  const router = useRouter();
  const idempotencyRef = useRef(crypto.randomUUID());
  const [reason, setReason] = useState("");
  const [creditLimit, setCreditLimit] = useState(
    customer.creditLimitCents != null ? String(customer.creditLimitCents / 100) : "",
  );
  const [overrideUntil, setOverrideUntil] = useState("");
  const [followUpDate, setFollowUpDate] = useState(customer.financeReviewFollowUpDate ?? "");
  const [reviewOwnerId, setReviewOwnerId] = useState(customer.financeReviewOwnerAdminId ?? "");
  const [resolution, setResolution] = useState("");
  const [showTimeline, setShowTimeline] = useState(false);
  const [loadedTimeline, setLoadedTimeline] = useState<MonthlyGovernanceTimelineEvent[] | null>(
    timeline ?? null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const overrideInfo = computeOverrideExpiryInfo(customer.manualOverrideUntil);

  useEffect(() => {
    if (!showTimeline || loadedTimeline) return;
    void fetch(`/api/admin/monthly-billing/accounts/${encodeURIComponent(customer.customerId)}/governance-timeline`)
      .then((response) => response.json())
      .then((json: { ok?: boolean; timeline?: MonthlyGovernanceTimelineEvent[] }) => {
        if (json.ok && json.timeline) setLoadedTimeline(json.timeline);
      })
      .catch(() => undefined);
  }, [showTimeline, loadedTimeline, customer.customerId]);

  async function runAction(action: () => Promise<{ ok: boolean; message?: string }>, refresh = true) {
    setLoading(true);
    setMessage(null);
    const result = await action();
    setLoading(false);
    setMessage(result.ok ? "Saved." : result.message ?? "Action failed.");
    if (result.ok && refresh) router.refresh();
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(customer.customerId)}
          aria-label={`Select ${customer.customerName ?? customer.customerId}`}
          className="mt-1"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-zinc-900">
            <Link href={`/admin/customers/${customer.customerId}`} className="hover:underline">
              {customer.customerName ?? customer.customerId.slice(0, 8)}
            </Link>
          </p>
          <p className="text-sm text-zinc-600">
            {formatGovernanceStateLabel(customer.governanceState)} · Outstanding{" "}
            {formatMonthlyGovernanceZar(customer.outstandingBalanceCents)} · Pending{" "}
            {formatMonthlyGovernanceZar(customer.exposure.pendingExposureCents)} · Band{" "}
            {customer.exposure.exposureBand}
          </p>
          <p className="text-xs text-zinc-500">
            Risk {customer.riskScore} ({customer.riskLevel}) · Overdue {customer.overdueInvoiceCount} ·{" "}
            {formatRiskRecommendationLabel(customer.recommendation)}
          </p>
          <p className="text-xs text-zinc-500">
            Review: {formatFinanceReviewStatusLabel(customer.financeReviewStatus)}
            {customer.financeReviewFollowUpDate ? ` · Follow-up ${customer.financeReviewFollowUpDate}` : ""}
            {customer.notesCount > 0 ? ` · ${customer.notesCount} notes` : ""}
          </p>

          {customer.manualOverrideUntil ? (
            <span
              className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${overrideInfo.badgeClass}`}
              data-testid="monthly-governance-override-badge"
            >
              {overrideInfo.label}
            </span>
          ) : null}

          <CreditUtilizationBar customer={customer} />

          <label className="mt-3 block text-xs">
            Reason (required for all actions)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1"
            />
          </label>

          <GovernanceActionButtons customer={customer} reason={reason} loading={loading} idempotencyRef={idempotencyRef} runAction={runAction} />

          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
            <label>
              Review owner (admin profile UUID)
              <input
                value={reviewOwnerId}
                onChange={(e) => setReviewOwnerId(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1"
              />
            </label>
            <label>
              Follow-up date
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1"
              />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              disabled={loading || !reason.trim()}
              className="rounded border px-2 py-1"
              onClick={() =>
                void runAction(async () =>
                  updateMonthlyAccountFinanceReview(customer.customerId, {
                    reason: reason.trim(),
                    idempotencyKey: `${idempotencyRef.current}:assign`,
                    confirmAction: true,
                    reviewOwnerAdminId: reviewOwnerId.trim() || null,
                    followUpDate: followUpDate || null,
                    reviewStatus: "open",
                  }),
                )
              }
            >
              Assign owner / follow-up
            </button>
            <button
              type="button"
              disabled={loading || !reason.trim()}
              className="rounded border px-2 py-1"
              onClick={() =>
                void runAction(async () =>
                  updateMonthlyAccountFinanceReview(customer.customerId, {
                    reason: reason.trim(),
                    idempotencyKey: `${idempotencyRef.current}:resolve`,
                    confirmAction: true,
                    reviewStatus: "resolved",
                    resolution: resolution.trim() || reason.trim(),
                  }),
                )
              }
            >
              Resolve review
            </button>
            <button
              type="button"
              disabled={loading || !reason.trim()}
              className="rounded border px-2 py-1"
              onClick={() =>
                void runAction(async () =>
                  updateMonthlyAccountFinanceReview(customer.customerId, {
                    reason: reason.trim(),
                    idempotencyKey: `${idempotencyRef.current}:dismiss`,
                    confirmAction: true,
                    reviewStatus: "dismissed",
                    resolution: resolution.trim() || reason.trim(),
                  }),
                )
              }
            >
              Dismiss review
            </button>
          </div>
          <label className="mt-2 block text-xs">
            Resolution / dismiss reason
            <input
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1"
            />
          </label>

          <GovernanceLimitOverrideFieldsBody
            customer={customer}
            reason={reason}
            creditLimit={creditLimit}
            setCreditLimit={setCreditLimit}
            overrideUntil={overrideUntil}
            setOverrideUntil={setOverrideUntil}
            loading={loading}
            idempotencyRef={idempotencyRef}
            runAction={runAction}
          />

          <button
            type="button"
            className="mt-2 text-xs text-blue-700 underline"
            onClick={() => setShowTimeline((value) => !value)}
          >
            {showTimeline ? "Hide governance timeline" : "Show governance timeline"}
          </button>
          {showTimeline && loadedTimeline ? (
            <div className="mt-2">
              <AdminMonthlyGovernanceTimeline events={loadedTimeline} compact />
            </div>
          ) : null}

          <Link href="/admin/operations/monthly-collections" className="mt-2 inline-block text-xs text-blue-700 underline">
            Open collections dashboard
          </Link>

          {message ? <p className="mt-2 text-xs text-zinc-600">{message}</p> : null}
        </div>
      </div>
    </div>
  );
}

function GovernanceActionButtons({
  customer,
  reason,
  loading,
  idempotencyRef,
  runAction,
}: {
  customer: CustomerRow;
  reason: string;
  loading: boolean;
  idempotencyRef: React.RefObject<string>;
  runAction: (action: () => Promise<{ ok: boolean; message?: string }>, refresh?: boolean) => Promise<void>;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs">
      <button type="button" disabled={loading || !reason.trim()} className="rounded border px-2 py-1" onClick={() => void runAction(async () => updateMonthlyAccountGovernanceState(customer.customerId, { governanceState: "account_review_required", reason: reason.trim(), idempotencyKey: `${idempotencyRef.current}:review`, confirmAction: true }))}>Start review</button>
      <button type="button" disabled={loading || !reason.trim()} className="rounded border px-2 py-1" onClick={() => void runAction(async () => updateMonthlyAccountGovernanceState(customer.customerId, { governanceState: "finance_hold", reason: reason.trim(), idempotencyKey: `${idempotencyRef.current}:hold`, confirmAction: true }))}>Finance hold</button>
      <button type="button" disabled={loading || !reason.trim()} className="rounded border px-2 py-1" onClick={() => void runAction(async () => updateMonthlyAccountGovernanceState(customer.customerId, { governanceState: "disputed", reason: reason.trim(), idempotencyKey: `${idempotencyRef.current}:disputed`, confirmAction: true }))}>Mark disputed</button>
      <button type="button" disabled={loading || !reason.trim()} className="rounded border px-2 py-1 text-red-700" onClick={() => void runAction(async () => updateMonthlyAccountGovernanceState(customer.customerId, { governanceState: "suspended", reason: reason.trim(), idempotencyKey: `${idempotencyRef.current}:suspend`, confirmAction: true }))}>Suspend</button>
      <button type="button" disabled={loading || !reason.trim()} className="rounded border px-2 py-1" onClick={() => void runAction(async () => updateMonthlyAccountGovernanceState(customer.customerId, { governanceState: "approved", reason: reason.trim(), idempotencyKey: `${idempotencyRef.current}:unsuspend`, confirmAction: true }))}>Unsuspend / approve</button>
    </div>
  );
}

function GovernanceLimitOverrideFieldsBody(props: {
  customer: CustomerRow;
  reason: string;
  creditLimit: string;
  setCreditLimit: (value: string) => void;
  overrideUntil: string;
  setOverrideUntil: (value: string) => void;
  loading: boolean;
  idempotencyRef: React.RefObject<string>;
  runAction: (action: () => Promise<{ ok: boolean; message?: string }>, refresh?: boolean) => Promise<void>;
}) {
  const { customer, reason, creditLimit, setCreditLimit, overrideUntil, setOverrideUntil, loading, idempotencyRef, runAction } = props;
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 text-xs">
      <label>Credit limit (ZAR)<input value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} className="ml-1 rounded border border-zinc-300 px-2 py-1" /></label>
      <button type="button" disabled={loading || !reason.trim()} className="rounded border px-2 py-1" onClick={() => void runAction(async () => updateMonthlyAccountCreditLimit(customer.customerId, { creditLimitCents: creditLimit.trim() === "" ? null : Math.round(Number(creditLimit) * 100), reason: reason.trim(), idempotencyKey: `${idempotencyRef.current}:limit`, confirmAction: true }))}>Set limit</button>
      <label>Override until<input type="datetime-local" value={overrideUntil} onChange={(e) => setOverrideUntil(e.target.value)} className="ml-1 rounded border border-zinc-300 px-2 py-1" /></label>
      <button type="button" disabled={loading || !reason.trim() || !overrideUntil} className="rounded border px-2 py-1" onClick={() => void runAction(async () => grantMonthlyAccountTemporaryOverride(customer.customerId, { manualOverrideUntil: new Date(overrideUntil).toISOString(), reason: reason.trim(), idempotencyKey: `${idempotencyRef.current}:override`, confirmAction: true }))}>Grant override</button>
    </div>
  );
}

function filterAndSortCustomers(
  customers: CustomerRow[],
  filters: {
    governanceState: string;
    exposureBand: string;
    minOverdue: string;
    overrideExpiringSoon: boolean;
    search: string;
    sort: SortKey;
  },
): CustomerRow[] {
  let rows = [...customers];
  if (filters.governanceState !== "all") {
    rows = rows.filter((row) => row.governanceState === filters.governanceState);
  }
  if (filters.exposureBand !== "all") {
    rows = rows.filter((row) => row.exposure.exposureBand === filters.exposureBand);
  }
  if (filters.minOverdue !== "all") {
    const min = Number(filters.minOverdue);
    rows = rows.filter((row) => row.overdueInvoiceCount >= min);
  }
  if (filters.overrideExpiringSoon) {
    rows = rows.filter((row) => row.overrideExpiringSoon);
  }
  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        row.customerId.toLowerCase().includes(q) ||
        (row.customerName ?? "").toLowerCase().includes(q),
    );
  }

  rows.sort((a, b) => {
    switch (filters.sort) {
      case "exposure":
        return (b.exposure.exposurePercent ?? -1) - (a.exposure.exposurePercent ?? -1);
      case "overdue":
        return b.overdueInvoiceCount - a.overdueInvoiceCount;
      case "lastReview":
        return new Date(b.lastFinanceReviewAt ?? 0).getTime() - new Date(a.lastFinanceReviewAt ?? 0).getTime();
      case "riskScore":
        return b.riskScore - a.riskScore;
      case "name":
        return (a.customerName ?? a.customerId).localeCompare(b.customerName ?? b.customerId);
      default:
        return 0;
    }
  });

  return rows;
}

export function AdminMonthlyGovernanceDashboard({ dashboard, timelinesByCustomerId = {} }: Props) {
  const router = useRouter();
  const bulkIdempotencyRef = useRef(crypto.randomUUID());
  const [governanceState, setGovernanceState] = useState("all");
  const [exposureBand, setExposureBand] = useState("all");
  const [minOverdue, setMinOverdue] = useState("all");
  const [overrideExpiringSoon, setOverrideExpiringSoon] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("riskScore");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkOwnerId, setBulkOwnerId] = useState("");
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const filteredCustomers = useMemo(
    () =>
      filterAndSortCustomers(dashboard.customers, {
        governanceState,
        exposureBand,
        minOverdue,
        overrideExpiringSoon,
        search,
        sort,
      }),
    [dashboard.customers, governanceState, exposureBand, minOverdue, overrideExpiringSoon, search, sort],
  );

  function toggleSelect(customerId: string) {
    setSelectedIds((current) =>
      current.includes(customerId) ? current.filter((id) => id !== customerId) : [...current, customerId],
    );
  }

  async function runBulk(action: "mark_finance_review" | "add_note" | "assign_review_owner") {
    if (!bulkReason.trim() || selectedIds.length === 0) return;
    setBulkLoading(true);
    setBulkMessage(null);
    const result = await executeMonthlyGovernanceBulkAction({
      action,
      customerIds: selectedIds,
      reason: bulkReason.trim(),
      idempotencyKey: bulkIdempotencyRef.current,
      confirmAction: true,
      reviewOwnerAdminId: bulkOwnerId.trim() || null,
    });
    setBulkLoading(false);
    if (!result.ok) {
      setBulkMessage(result.message);
      return;
    }
    setBulkMessage(`Processed ${result.result.processed} account(s). Failed: ${result.result.failed.length}.`);
    bulkIdempotencyRef.current = crypto.randomUUID();
    router.refresh();
  }

  const exportSelectedHref =
    selectedIds.length > 0
      ? `/api/admin/monthly-billing/governance?export=csv&customerIds=${encodeURIComponent(selectedIds.join(","))}`
      : "/api/admin/monthly-billing/governance?export=csv";

  return (
    <div className="space-y-6">
      {!dashboard.governanceEnabled ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" data-testid="monthly-governance-disabled-banner">
          Monthly credit governance is disabled (ZOHO_MONTHLY_CREDIT_GOVERNANCE_ENABLED).
        </p>
      ) : null}

      {dashboard.internalAlerts.length > 0 ? (
        <section aria-label="Internal governance alerts" data-testid="monthly-governance-internal-alerts" className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-800">Internal alerts (admin only)</h3>
          <ul className="space-y-1 text-sm text-amber-950">
            {dashboard.internalAlerts.map((alert) => (
              <li key={`${alert.kind}:${alert.customerId}`} className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
                {alert.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Governance section counts" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="monthly-governance-section-counts">
        {Object.entries(dashboard.sectionCounts).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{key.replace(/([A-Z])/g, " $1")}</p>
            <p className="text-xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section aria-label="Governance filters" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6" data-testid="monthly-governance-filters">
        <label className="text-xs">Governance state<select value={governanceState} onChange={(e) => setGovernanceState(e.target.value)} className="mt-1 block w-full rounded border px-2 py-1"><option value="all">All</option><option value="approved">Approved</option><option value="account_review_required">Review required</option><option value="finance_hold">Finance hold</option><option value="disputed">Disputed</option><option value="suspended">Suspended</option></select></label>
        <label className="text-xs">Exposure band<select value={exposureBand} onChange={(e) => setExposureBand(e.target.value)} className="mt-1 block w-full rounded border px-2 py-1"><option value="all">All</option><option value="healthy">Healthy</option><option value="warning">Warning</option><option value="elevated">Elevated</option><option value="exceeded">Exceeded</option></select></label>
        <label className="text-xs">Min overdue<select value={minOverdue} onChange={(e) => setMinOverdue(e.target.value)} className="mt-1 block w-full rounded border px-2 py-1"><option value="all">Any</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option></select></label>
        <label className="text-xs">Sort by<select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="mt-1 block w-full rounded border px-2 py-1"><option value="riskScore">Risk score</option><option value="exposure">Exposure %</option><option value="overdue">Overdue count</option><option value="lastReview">Last review</option><option value="name">Customer name</option></select></label>
        <label className="text-xs">Search customer<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or ID" className="mt-1 block w-full rounded border px-2 py-1" /></label>
        <label className="flex items-end gap-2 text-xs"><input type="checkbox" checked={overrideExpiringSoon} onChange={(e) => setOverrideExpiringSoon(e.target.checked)} />Override expiring soon</label>
      </section>

      <section aria-label="Bulk governance actions" data-testid="monthly-governance-bulk-actions" className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <h3 className="text-sm font-semibold">Bulk review actions ({selectedIds.length} selected)</h3>
        <p className="text-xs text-zinc-600">Allowed: mark for finance review, add note, assign review owner, export selected. Bulk suspend/override/limit changes are not available.</p>
        <textarea value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} rows={2} placeholder="Reason required for every bulk action" className="mt-2 w-full rounded border px-2 py-1 text-sm" />
        <input value={bulkOwnerId} onChange={(e) => setBulkOwnerId(e.target.value)} placeholder="Review owner admin UUID (assign bulk)" className="mt-2 w-full rounded border px-2 py-1 text-sm" />
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <button type="button" disabled={bulkLoading || !bulkReason.trim() || selectedIds.length === 0} className="rounded border px-3 py-1" onClick={() => void runBulk("mark_finance_review")}>Bulk mark finance review</button>
          <button type="button" disabled={bulkLoading || !bulkReason.trim() || selectedIds.length === 0} className="rounded border px-3 py-1" onClick={() => void runBulk("add_note")}>Bulk add note</button>
          <button type="button" disabled={bulkLoading || !bulkReason.trim() || selectedIds.length === 0 || !bulkOwnerId.trim()} className="rounded border px-3 py-1" onClick={() => void runBulk("assign_review_owner")}>Bulk assign owner</button>
          <a href={exportSelectedHref} className="rounded border px-3 py-1 hover:bg-white">Export selected CSV</a>
          <a href="/api/admin/monthly-billing/governance?export=json" className="rounded border px-3 py-1 hover:bg-white">Export all JSON</a>
        </div>
        {bulkMessage ? <p className="mt-2 text-xs text-zinc-600">{bulkMessage}</p> : null}
      </section>

      <section aria-label="Filtered accounts" data-testid="monthly-governance-filtered-list" className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-800">Accounts ({filteredCustomers.length})</h3>
        {filteredCustomers.map((customer) => (
          <GovernanceCustomerCard
            key={customer.customerId}
            customer={customer}
            timeline={timelinesByCustomerId[customer.customerId]}
            selected={selectedIds.includes(customer.customerId)}
            onToggleSelect={toggleSelect}
          />
        ))}
      </section>
    </div>
  );
}
