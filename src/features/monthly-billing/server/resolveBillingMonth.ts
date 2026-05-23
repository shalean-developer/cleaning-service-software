import "server-only";

const JOHANNESBURG = "Africa/Johannesburg";

/**
 * First day of calendar month in Africa/Johannesburg for a UTC instant.
 * Returns YYYY-MM-DD (e.g. 2026-06-01).
 */
export function resolveBillingMonthFromInstant(isoInstant: string): string | null {
  const date = new Date(isoInstant);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JOHANNESBURG,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  if (!year || !month) return null;
  return `${year}-${month}-01`;
}

/** Local visit date YYYY-MM-DD in Africa/Johannesburg. */
export function resolveVisitDateFromInstant(isoInstant: string): string | null {
  const date = new Date(isoInstant);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JOHANNESBURG,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}
