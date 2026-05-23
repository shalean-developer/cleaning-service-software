export type OverrideExpiryState = "none" | "active" | "expired" | "expiring_soon";

export type OverrideExpiryInfo = {
  state: OverrideExpiryState;
  expiresInDays: number | null;
  label: string;
  badgeClass: string;
};

const EXPIRING_SOON_DAYS = 7;

export function computeOverrideExpiryInfo(
  manualOverrideUntil: string | null,
  now = new Date(),
): OverrideExpiryInfo {
  if (!manualOverrideUntil) {
    return {
      state: "none",
      expiresInDays: null,
      label: "No override",
      badgeClass: "bg-zinc-100 text-zinc-700",
    };
  }

  const untilMs = new Date(manualOverrideUntil).getTime();
  if (Number.isNaN(untilMs)) {
    return {
      state: "none",
      expiresInDays: null,
      label: "Invalid override date",
      badgeClass: "bg-zinc-100 text-zinc-700",
    };
  }

  const diffMs = untilMs - now.getTime();
  const expiresInDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  if (diffMs <= 0) {
    return {
      state: "expired",
      expiresInDays,
      label: "Override expired",
      badgeClass: "bg-zinc-200 text-zinc-700",
    };
  }

  if (expiresInDays <= EXPIRING_SOON_DAYS) {
    return {
      state: "expiring_soon",
      expiresInDays,
      label: `Expires in ${expiresInDays} day${expiresInDays === 1 ? "" : "s"}`,
      badgeClass: "bg-amber-100 text-amber-900",
    };
  }

  return {
    state: "active",
    expiresInDays,
    label: `Active · expires in ${expiresInDays} days`,
    badgeClass: "bg-emerald-100 text-emerald-900",
  };
}

export function isOverrideExpiringSoon(
  manualOverrideUntil: string | null,
  now = new Date(),
): boolean {
  return computeOverrideExpiryInfo(manualOverrideUntil, now).state === "expiring_soon";
}
