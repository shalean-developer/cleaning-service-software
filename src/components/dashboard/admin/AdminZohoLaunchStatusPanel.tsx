"use client";

import type { ZohoPaymentFeatureState } from "@/features/zoho-invoice-payments/server/zohoPaymentLaunchGuard";

type Props = {
  featureState: ZohoPaymentFeatureState;
  lastCronRun: {
    jobName: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
  } | null;
};

function StatusBadge({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        enabled ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
      }`}
    >
      {label}: {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

function paystackModeLabel(mode: ZohoPaymentFeatureState["paystackMode"]): string {
  switch (mode) {
    case "test":
      return "Test";
    case "live":
      return "Live";
    case "disabled":
      return "Disabled";
    default:
      return "Unknown";
  }
}

export function AdminZohoLaunchStatusPanel({ featureState, lastCronRun }: Props) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Launch status</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Production feature flags and readiness indicators. No secrets are shown here.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge enabled={featureState.invoicePaymentsEnabled} label="Invoice payments" />
        <StatusBadge enabled={featureState.savedMethodsEnabled} label="Saved methods" />
        <StatusBadge enabled={featureState.adminCardChargesEnabled} label="Admin card charges" />
      </div>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-zinc-500">Paystack mode</dt>
          <dd className="mt-0.5 font-medium text-zinc-900">
            {paystackModeLabel(featureState.paystackMode)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-zinc-500">Zoho configured</dt>
          <dd className="mt-0.5 font-medium text-zinc-900">
            {featureState.zohoConfigured ? "Yes" : "No"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-zinc-500">Cron secret configured</dt>
          <dd className="mt-0.5 font-medium text-zinc-900">
            {featureState.cronSecretConfigured ? "Yes" : "No — set CRON_SECRET"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-zinc-500">Paystack webhook configured</dt>
          <dd className="mt-0.5 font-medium text-zinc-900">
            {featureState.paystackWebhookConfigured
              ? "Yes (dedicated webhook secret)"
              : "Review — use PAYSTACK_WEBHOOK_SECRET"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-zinc-500">Last reconcile cron run</dt>
          <dd className="mt-0.5 text-zinc-900">
            {lastCronRun ? (
              <>
                <span className="font-medium">{lastCronRun.status}</span>
                {" · "}
                Started {new Date(lastCronRun.startedAt).toLocaleString("en-ZA")}
                {lastCronRun.completedAt
                  ? ` · Completed ${new Date(lastCronRun.completedAt).toLocaleString("en-ZA")}`
                  : null}
              </>
            ) : (
              "No cron runs recorded yet."
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
