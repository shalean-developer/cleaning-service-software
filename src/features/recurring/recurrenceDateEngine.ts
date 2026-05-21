import { WIZARD_TIMEZONE } from "@/features/booking-wizard/constants";
import type { RecurringSeriesFrequency } from "./types";

const MS_PER_DAY = 86_400_000;

type JohannesburgParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseJohannesburgParts(instant: Date): JohannesburgParts {
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
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((p) => p.type === type)?.value ?? "0";
    return Number.parseInt(value, 10);
  };
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

/** Build timestamptz preserving wall-clock in SAST (+02:00). */
export function johannesburgWallClockToIso(parts: JohannesburgParts): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const dayKey = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  return new Date(
    `${dayKey}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}+02:00`,
  ).toISOString();
}

export function computeMonthlyNextOccurrence(scheduledStartIso: string): string {
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

/**
 * Next occurrence instant strictly after `scheduledStartIso` for the series frequency.
 * Weekly +7d, biweekly +14d, monthly same JHB calendar day with month-end clamp.
 */
export function computeNextOccurrenceAfter(
  frequency: RecurringSeriesFrequency,
  scheduledStartIso: string,
): string {
  const anchorMs = new Date(scheduledStartIso).getTime();
  if (frequency === "weekly") {
    return new Date(anchorMs + 7 * MS_PER_DAY).toISOString();
  }
  if (frequency === "biweekly") {
    return new Date(anchorMs + 14 * MS_PER_DAY).toISOString();
  }
  return computeMonthlyNextOccurrence(scheduledStartIso);
}

/** All occurrence starts from `firstScheduledStart` up to and including `horizonEndIso`. */
export function listOccurrenceStartsThroughHorizon(input: {
  frequency: RecurringSeriesFrequency;
  firstScheduledStart: string;
  horizonEndIso: string;
  maxCount?: number;
}): string[] {
  const out: string[] = [];
  let cursor = input.firstScheduledStart;
  const horizonMs = new Date(input.horizonEndIso).getTime();
  const max = input.maxCount ?? 64;

  while (out.length < max) {
    const next = computeNextOccurrenceAfter(input.frequency, cursor);
    if (new Date(next).getTime() > horizonMs) break;
    out.push(next);
    cursor = next;
  }

  return out;
}

export function bookingDurationMs(
  scheduledStart: string,
  scheduledEnd: string,
): number {
  return Math.max(0, new Date(scheduledEnd).getTime() - new Date(scheduledStart).getTime());
}

export function scheduledEndForStart(
  scheduledStart: string,
  durationMs: number,
): string {
  return new Date(new Date(scheduledStart).getTime() + durationMs).toISOString();
}
