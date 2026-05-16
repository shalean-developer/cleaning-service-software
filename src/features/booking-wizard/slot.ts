import { WIZARD_JOB_DURATION_MINUTES, WIZARD_TIMEZONE } from "./constants";

export type BookingSlot = {
  scheduledStart: string;
  scheduledEnd: string;
};

/** Build ISO slot using South Africa (UTC+2, no DST). */
export function buildWizardSlot(
  date: string,
  time: string,
  durationMinutes: number = WIZARD_JOB_DURATION_MINUTES,
): BookingSlot | null {
  const trimmedDate = date.trim();
  const trimmedTime = time.trim();
  if (!trimmedDate || !trimmedTime) return null;

  const timePart = trimmedTime.length === 5 ? `${trimmedTime}:00` : trimmedTime;
  const start = new Date(`${trimmedDate}T${timePart}+02:00`);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return {
    scheduledStart: start.toISOString(),
    scheduledEnd: end.toISOString(),
  };
}

export function isSlotInPast(date: string, time: string, now: Date = new Date()): boolean {
  const slot = buildWizardSlot(date, time, 1);
  if (!slot) return true;
  return new Date(slot.scheduledStart).getTime() < now.getTime();
}

export function minBookableDateString(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: WIZARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

export { WIZARD_TIMEZONE };
