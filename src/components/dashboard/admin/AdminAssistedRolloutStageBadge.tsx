import {
  ADMIN_ASSISTED_ROLLOUT_STAGE_LABELS,
  type AdminAssistedBookingRolloutStage,
} from "@/lib/app/resolveAdminAssistedBookingRolloutStage";

type Props = {
  stage: AdminAssistedBookingRolloutStage;
  description?: string;
  compact?: boolean;
};

const STAGE_TONE: Record<AdminAssistedBookingRolloutStage, string> = {
  disabled: "bg-zinc-100 text-zinc-700",
  draft_only: "bg-sky-50 text-sky-900",
  payment_links: "bg-indigo-50 text-indigo-900",
  offline_eft: "bg-amber-50 text-amber-950",
  offline_full: "bg-emerald-50 text-emerald-900",
};

export function AdminAssistedRolloutStageBadge({ stage, description, compact }: Props) {
  return (
    <div
      className={`inline-flex flex-col gap-1 rounded-lg border border-zinc-200/80 px-3 py-2 ${compact ? "text-xs" : "text-sm"}`}
      data-testid="admin-assisted-rollout-stage-badge"
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        Rollout stage
      </span>
      <span
        className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${STAGE_TONE[stage]}`}
      >
        {ADMIN_ASSISTED_ROLLOUT_STAGE_LABELS[stage]}
      </span>
      {description && !compact ? (
        <p className="max-w-prose text-xs text-zinc-600">{description}</p>
      ) : null}
    </div>
  );
}
