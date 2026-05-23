import "server-only";

export function isPaymentMethodExpired(
  expMonth: string | null,
  expYear: string | null,
  now: Date = new Date(),
): boolean {
  if (!expMonth?.trim() || !expYear?.trim()) {
    return false;
  }

  const month = Number.parseInt(expMonth.trim(), 10);
  let year = Number.parseInt(expYear.trim(), 10);
  if (!Number.isFinite(month) || month < 1 || month > 12 || !Number.isFinite(year)) {
    return false;
  }

  if (year < 100) {
    year += 2000;
  }

  const expiryEnd = new Date(year, month, 0, 23, 59, 59, 999);
  return now > expiryEnd;
}
