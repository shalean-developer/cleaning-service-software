import type { BookingSlot } from "../types";

const DEFAULT_TIMEZONE = "Africa/Johannesburg";

export type ParsedSlot = {
  start: Date;
  end: Date;
  dayOfWeek: number;
  /** HH:mm:ss in the window timezone */
  localTime: string;
  timezone: string;
};

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Parses an ISO slot using the default job timezone for recurring windows.
 */
export function parseBookingSlot(
  slot: BookingSlot,
  timezone: string = DEFAULT_TIMEZONE,
): ParsedSlot | null {
  const start = new Date(slot.scheduledStart);
  const end = new Date(slot.scheduledEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(start);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const second = parts.find((p) => p.type === "second")?.value ?? "00";
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const dayOfWeek = dayMap[weekday] ?? start.getUTCDay();

  return {
    start,
    end,
    dayOfWeek,
    localTime: `${hour}:${minute}:${second}`,
    timezone,
  };
}

export function buildSlotFromDateAndTime(
  date: string,
  time: string,
  durationMinutes: number,
  timezone: string = DEFAULT_TIMEZONE,
): BookingSlot | null {
  const trimmedDate = date.trim();
  const trimmedTime = time.trim();
  if (!trimmedDate || !trimmedTime) return null;

  const isoLocal = `${trimmedDate}T${trimmedTime.length === 5 ? `${trimmedTime}:00` : trimmedTime}`;
  const start = new Date(isoLocal);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return {
    scheduledStart: start.toISOString(),
    scheduledEnd: end.toISOString(),
  };
}

export function summarizeAvailability(windows: { dayOfWeek: number; startTime: string; endTime: string }[]): string {
  if (windows.length === 0) return "No recurring windows configured";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const sample = windows
    .slice(0, 3)
    .map((w) => `${days[w.dayOfWeek] ?? "?"} ${w.startTime.slice(0, 5)}–${w.endTime.slice(0, 5)}`)
    .join(", ");
  return windows.length > 3 ? `${sample}, …` : sample;
}

export function summarizeServiceAreas(areas: string[]): string {
  if (areas.length === 0) return "All service areas";
  if (areas.length <= 3) return areas.join(", ");
  return `${areas.slice(0, 3).join(", ")} +${areas.length - 3} more`;
}

export { DEFAULT_TIMEZONE };
