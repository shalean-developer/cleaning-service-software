import type { OfferExpiryUrgency } from "@/features/dashboards/server/formatOfferExpiryDisplay";
import type { StatusBadgeTone } from "@/features/bookings/server/statusLabels";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

type Props = {
  relativeLabel: string;
  ariaLabel: string;
  urgency: OfferExpiryUrgency;
};

function toneForUrgency(urgency: OfferExpiryUrgency): StatusBadgeTone {
  switch (urgency) {
    case "warning":
      return "warning";
    case "expired":
      return "neutral";
    default:
      return "info";
  }
}

/** Display-only expiry urgency chip for cleaner offer cards (no live countdown). */
export function OfferExpiryChip({ relativeLabel, ariaLabel, urgency }: Props) {
  return (
    <span aria-label={ariaLabel}>
      <StatusBadge label={relativeLabel} tone={toneForUrgency(urgency)} />
    </span>
  );
}
