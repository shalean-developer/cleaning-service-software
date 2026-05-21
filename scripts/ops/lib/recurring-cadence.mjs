/** Shared cadence helpers for ops audit/repair scripts (mirrors app read paths). */

const PRICING_FREQUENCIES = ["once", "weekly", "biweekly", "monthly"];
const WIZARD_TIMEZONE = "Africa/Johannesburg";
const MS_PER_DAY = 86_400_000;

const PAID_STATUSES = new Set([
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
]);

export function readBookingFrequencyFromMetadata(metadata) {
  const record =
    metadata != null && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata
      : {};
  const quote =
    record.quote != null && typeof record.quote === "object" && !Array.isArray(record.quote)
      ? record.quote
      : null;
  const quoteInput =
    quote?.input != null && typeof quote.input === "object" && !Array.isArray(quote.input)
      ? quote.input
      : null;
  const raw =
    (typeof record.frequency === "string" ? record.frequency : null) ??
    (typeof quote?.frequency === "string" ? quote.frequency : null) ??
    (typeof quoteInput?.frequency === "string" ? quoteInput.frequency : null);
  if (raw && PRICING_FREQUENCIES.includes(raw)) return raw;
  return "once";
}

export function readServiceSlugFromBookingMetadata(metadata) {
  const record =
    metadata != null && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata
      : {};
  const quote = record.quote;
  if (quote != null && typeof quote === "object" && !Array.isArray(quote)) {
    const input = quote.input;
    if (input != null && typeof input === "object" && !Array.isArray(input)) {
      const slug = input.serviceSlug;
      if (typeof slug === "string" && slug.trim()) return slug.trim();
    }
  }
  const top = record.serviceSlug ?? record.service_slug;
  return typeof top === "string" && top.trim() ? top.trim() : null;
}

export function seriesFrequencyFromPricing(frequency) {
  if (frequency === "once") return null;
  return frequency;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseJohannesburgParts(instant) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: WIZARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(instant);
  const read = (type) => Number.parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function johannesburgWallClockToIso(parts) {
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  return new Date(
    `${dayKey}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}+02:00`,
  ).toISOString();
}

function computeMonthlyNextOccurrence(scheduledStartIso) {
  const anchor = parseJohannesburgParts(new Date(scheduledStartIso));
  let year = anchor.year;
  let month = anchor.month + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  const day = Math.min(anchor.day, daysInMonth(year, month));
  return johannesburgWallClockToIso({
    year,
    month,
    day,
    hour: anchor.hour,
    minute: anchor.minute,
    second: anchor.second,
  });
}

export function computeNextOccurrenceAfter(frequency, scheduledStartIso) {
  const anchorMs = new Date(scheduledStartIso).getTime();
  if (frequency === "weekly") {
    return new Date(anchorMs + 7 * MS_PER_DAY).toISOString();
  }
  if (frequency === "biweekly") {
    return new Date(anchorMs + 14 * MS_PER_DAY).toISOString();
  }
  return computeMonthlyNextOccurrence(scheduledStartIso);
}

export function findPaidMetadataNoSeriesBookings(bookings) {
  return (bookings ?? []).filter((b) => {
    const freq = readBookingFrequencyFromMetadata(b.metadata);
    return freq !== "once" && !b.series_id && PAID_STATUSES.has(b.status);
  });
}
