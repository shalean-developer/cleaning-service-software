import Link from "next/link";
import type { CleanerOperationalDiagnostics } from "@/features/cleaners/server/admin/cleanerOperationalDiagnostics";
import type { CleanerOperationalState } from "@/features/cleaners/server/lifecycle/operationalState";
import { AdminCleanerLifecycleActions } from "@/components/dashboard/admin/AdminCleanerLifecycleActions";
import type { AdminCleanerSafetyCounts } from "@/features/cleaners/server/admin/types";

type Props = {
  cleanerId: string;
  operationalState: CleanerOperationalState;
  active: boolean;
  onboardingCompletedAt: string | null;
  diagnostics: CleanerOperationalDiagnostics;
  safetyCounts: AdminCleanerSafetyCounts;
};

function StatusRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
      <span className="text-zinc-600">{label}</span>
      <span className={ok ? "font-medium text-emerald-800" : "font-medium text-amber-900"}>
        {ok ? "OK" : "Needs attention"}
        {detail ? `. ${detail}` : ""}
      </span>
    </div>
  );
}

export function AdminCleanerRemediationPanel({
  cleanerId,
  operationalState,
  active,
  onboardingCompletedAt,
  diagnostics,
  safetyCounts,
}: Props) {
  const { profileCompleteness: completeness } = diagnostics;
  const profileAnchor = `#edit-profile`;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Operational remediation</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Dispatch eligibility, profile completeness, and safe lifecycle actions.
      </p>

      <div className="mt-4 space-y-2 rounded-md bg-zinc-50 px-3 py-3">
        <StatusRow
          label="Onboarding"
          ok={onboardingCompletedAt != null}
          detail={
            onboardingCompletedAt
              ? new Date(onboardingCompletedAt).toLocaleDateString()
              : "Not completed"
          }
        />
        <StatusRow label="Active flag" ok={active === (operationalState === "active")} />
        <StatusRow
          label="Capabilities"
          ok={!completeness.missingSections.includes("capabilities")}
        />
        <StatusRow
          label="Availability"
          ok={!completeness.missingSections.includes("availability")}
        />
        <StatusRow
          label="Service areas"
          ok={!completeness.missingSections.includes("service_areas")}
        />
        <StatusRow
          label="Dispatch eligibility"
          ok={diagnostics.lifecycleDispatchEligible}
        />
        <StatusRow
          label="Assignment probe"
          ok={diagnostics.assignmentEligibilityCode === "active"}
          detail={diagnostics.assignmentEligibilityMessage ?? undefined}
        />
        <p className="pt-2 text-sm font-medium text-zinc-800">
          Profile completeness: {completeness.completionPercent}%
          {completeness.dispatchReady ? " · Dispatch-ready" : ""}
        </p>
      </div>

      {diagnostics.warnings.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {diagnostics.warnings.map((warning) => (
            <li
              key={warning}
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
            >
              {warning}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-emerald-800">No operational warnings.</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {operationalState === "onboarding" ? (
          <span className="text-zinc-600">
            Use lifecycle actions below to complete onboarding when profile is ready.
          </span>
        ) : null}
        <Link
          href={profileAnchor}
          className="font-medium text-zinc-900 underline-offset-2 hover:underline"
        >
          Open profile setup
        </Link>
      </div>

      <div className="mt-6 border-t border-zinc-100 pt-4">
        <AdminCleanerLifecycleActions
          cleanerId={cleanerId}
          operationalState={operationalState}
          safetyCounts={safetyCounts}
        />
      </div>
    </section>
  );
}
