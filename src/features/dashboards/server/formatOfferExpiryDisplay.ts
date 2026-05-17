export type OfferExpiryUrgency = "normal" | "warning" | "expired";

export type OfferExpiryDisplay = {
  relativeLabel: string | null;
  absoluteLabel: string | null;
  urgency: OfferExpiryUrgency;
  isUrgent: boolean;
  isExpired: boolean;
  /** Accessible label including absolute expiry time. */
  ariaLabel: string | null;
};

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

function formatAbsoluteExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatRelativeRemaining(msRemaining: number): string {
  if (msRemaining < ONE_MINUTE_MS) {
    return "Respond soon";
  }
  if (msRemaining < ONE_HOUR_MS) {
    const minutes = Math.max(1, Math.ceil(msRemaining / ONE_MINUTE_MS));
    return `Respond within ${minutes}m`;
  }
  const hours = Math.max(1, Math.floor(msRemaining / ONE_HOUR_MS));
  return `Respond within ${hours}h`;
}

export function formatOfferExpiryDisplay(params: {
  expiresAt: string | null | undefined;
  isExpired?: boolean;
  now?: Date;
}): OfferExpiryDisplay {
  const now = params.now ?? new Date();
  const expired = params.isExpired === true;

  if (!params.expiresAt) {
    return {
      relativeLabel: null,
      absoluteLabel: null,
      urgency: "normal",
      isUrgent: false,
      isExpired: expired,
      ariaLabel: null,
    };
  }

  const absoluteLabel = formatAbsoluteExpiry(params.expiresAt);
  const expiresMs = new Date(params.expiresAt).getTime();
  const msRemaining = expiresMs - now.getTime();

  if (expired || msRemaining <= 0) {
    return {
      relativeLabel: "Expired",
      absoluteLabel,
      urgency: "expired",
      isUrgent: false,
      isExpired: true,
      ariaLabel: `Offer expired. Expired ${absoluteLabel}`,
    };
  }

  const isUrgent = msRemaining < ONE_HOUR_MS;
  const relativeLabel = formatRelativeRemaining(msRemaining);

  return {
    relativeLabel,
    absoluteLabel,
    urgency: isUrgent ? "warning" : "normal",
    isUrgent,
    isExpired: false,
    ariaLabel: `${relativeLabel}. Expires ${absoluteLabel}`,
  };
}
