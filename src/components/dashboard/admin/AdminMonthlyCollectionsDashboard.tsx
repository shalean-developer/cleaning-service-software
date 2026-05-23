"use client";

import type { MonthlyCollectionsDashboard } from "@/features/monthly-billing/server/loadMonthlyCollectionsDashboard";

type Props = {
  dashboard: MonthlyCollectionsDashboard;
};

type CustomerSummary = MonthlyCollectionsDashboard["overdue"][number];

function formatZar(cents: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function CustomerCard({ customer }: { customer: CustomerSummary }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="font-medium text-zinc-900">{customer.customerName ?? customer.customerId.slice(0, 8)}</p>
      <p className="text-sm text-zinc-600">
        Outstanding {formatZar(customer.outstandingTotalCents)} · Overdue {customer.overdueCount}
      </p>
      <p className="text-xs text-zinc-500">
        Risk {customer.riskScore} ({customer.riskLevel}) · {customer.recommendation}
      </p>
      <ul className="mt-2 space-y-1 text-xs text-zinc-700">
        {customer.batches.map((batch) => (
          <li key={batch.batchId}>
            {batch.billingMonth} · {batch.invoiceNumber ?? "—"} · {formatZar(batch.totalCents)} ·{" "}
            {batch.collectionsState}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CustomerSection({
  title,
  testId,
  customers,
}: {
  title: string;
  testId: string;
  customers: CustomerSummary[];
}) {
  if (customers.length === 0) return null;
  return (
    <section aria-label={title} data-testid={testId} className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-800">
        {title} ({customers.length})
      </h3>
      <div className="space-y-2">
        {customers.map((customer) => (
          <CustomerCard key={customer.customerId} customer={customer} />
        ))}
      </div>
    </section>
  );
}

export function AdminMonthlyCollectionsDashboard({ dashboard }: Props) {
  return (
    <div className="space-y-6">
      {!dashboard.collectionsEnabled ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          data-testid="monthly-collections-disabled-banner"
        >
          Monthly collections dashboard is disabled (ZOHO_MONTHLY_COLLECTIONS_ENABLED).
        </p>
      ) : null}

      <section aria-label="Collections metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Failed deliveries" value={dashboard.metrics.failedDeliveries} />
        <MetricCard label="No successful send" value={dashboard.metrics.batchesWithoutSuccessfulSend} />
        <MetricCard label="Auto-send eligible" value={dashboard.metrics.autoSendEligibleCount} />
        <MetricCard label="Avg payment days" value={dashboard.metrics.averagePaymentDays ?? "—"} />
      </section>

      <section aria-label="Aging buckets" data-testid="monthly-collections-aging-buckets">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-600">
          Invoice aging
        </h2>
        <AgingBuckets dashboard={dashboard} />
      </section>

      <div className="flex flex-wrap gap-2 text-sm">
        <a
          href="/api/admin/monthly-billing/collections?export=summary"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50"
        >
          Export summary CSV
        </a>
        <a
          href="/api/admin/monthly-billing/collections?export=overdue"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50"
        >
          Export overdue CSV
        </a>
        <a
          href="/api/admin/monthly-billing/collections?export=aging"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50"
        >
          Export aging CSV
        </a>
      </div>

      <CustomerSection
        title="Healthy invoices"
        testId="monthly-collections-healthy-section"
        customers={dashboard.healthy}
      />
      <CustomerSection
        title="Reminder due"
        testId="monthly-collections-reminder-due-section"
        customers={dashboard.reminderDue}
      />
      <CustomerSection
        title="Overdue"
        testId="monthly-collections-overdue-section"
        customers={dashboard.overdue}
      />
      <CustomerSection
        title="Escalation recommended"
        testId="monthly-collections-escalation-section"
        customers={dashboard.escalationRecommended}
      />
      <CustomerSection
        title="Disputed"
        testId="monthly-collections-disputed-section"
        customers={dashboard.disputed}
      />
      <CustomerSection
        title="High risk accounts"
        testId="monthly-collections-high-risk-section"
        customers={dashboard.highRisk}
      />
    </div>
  );
}

function AgingBuckets({ dashboard }: { dashboard: MonthlyCollectionsDashboard }) {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {Object.entries(dashboard.agingBuckets).map(([bucket, count]) => (
        <span key={bucket} className="rounded-full bg-zinc-100 px-3 py-1">
          {bucket}: {count}
        </span>
      ))}
    </div>
  );
}
