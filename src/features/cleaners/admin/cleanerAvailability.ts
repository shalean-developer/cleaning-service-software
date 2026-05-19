/** Weekly availability (0 = Sunday … 6 = Saturday). Matches `cleaner_availability.day_of_week`. */

export const CLEANER_AVAILABILITY_TIMEZONE_DEFAULT = "Africa/Johannesburg";

export const CLEANER_AVAILABILITY_DEFAULT_START = "07:00";

export const CLEANER_AVAILABILITY_DEFAULT_END = "18:00";

/** Monday–Saturday */
export const CLEANER_AVAILABILITY_DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6] as const;

export const CLEANER_AVAILABILITY_DAY_OPTIONS = [
  { value: 0, label: "Sunday", shortLabel: "Sun" },
  { value: 1, label: "Monday", shortLabel: "Mon" },
  { value: 2, label: "Tuesday", shortLabel: "Tue" },
  { value: 3, label: "Wednesday", shortLabel: "Wed" },
  { value: 4, label: "Thursday", shortLabel: "Thu" },
  { value: 5, label: "Friday", shortLabel: "Fri" },
  { value: 6, label: "Saturday", shortLabel: "Sat" },
] as const;

const DAY_SHORT_BY_VALUE = Object.fromEntries(
  CLEANER_AVAILABILITY_DAY_OPTIONS.map((d) => [d.value, d.shortLabel]),
) as Record<number, string>;

export type CleanerAvailabilityWindow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
};

export type CleanerAvailabilityFormValues = {
  workingDays: number[];
  startTime: string;
  endTime: string;
  timezone: string;
};

export type CleanerAvailabilityFormField =
  | "workingDays"
  | "startTime"
  | "endTime"
  | "timezone";

export type CleanerAvailabilityFormErrors = Partial<
  Record<CleanerAvailabilityFormField, string>
>;

export function defaultCleanerAvailabilityFormValues(): CleanerAvailabilityFormValues {
  return {
    workingDays: [...CLEANER_AVAILABILITY_DEFAULT_WORKING_DAYS],
    startTime: CLEANER_AVAILABILITY_DEFAULT_START,
    endTime: CLEANER_AVAILABILITY_DEFAULT_END,
    timezone: CLEANER_AVAILABILITY_TIMEZONE_DEFAULT,
  };
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function normalizeTimeForDb(value: string): string {
  const trimmed = value.trim();
  if (!TIME_PATTERN.test(trimmed)) return trimmed;
  return `${trimmed}:00`;
}

export function formatTimeForInput(dbTime: string): string {
  const match = /^(\d{2}:\d{2})/.exec(dbTime.trim());
  return match?.[1] ?? dbTime;
}

function parseTimeToMinutes(value: string): number | null {
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeWorkingDays(days: number[]): number[] {
  return days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
}

export function validateCleanerAvailabilityForm(
  values: CleanerAvailabilityFormValues,
): {
  valid: boolean;
  errors: CleanerAvailabilityFormErrors;
  windows: CleanerAvailabilityWindow[];
} {
  const errors: CleanerAvailabilityFormErrors = {};
  const rawDays = normalizeWorkingDays(values.workingDays);

  if (rawDays.length !== new Set(rawDays).size) {
    errors.workingDays = "Each day can only be selected once.";
  }

  const workingDays = [...new Set(rawDays)].sort((a, b) => a - b);

  if (workingDays.length === 0) {
    errors.workingDays = "Select at least one available day.";
  }

  const startTime = values.startTime.trim();
  const endTime = values.endTime.trim();
  const timezone = values.timezone.trim();

  if (!startTime || !TIME_PATTERN.test(startTime)) {
    errors.startTime = "Enter a valid start time (HH:MM, 24-hour).";
  }
  if (!endTime || !TIME_PATTERN.test(endTime)) {
    errors.endTime = "Enter a valid end time (HH:MM, 24-hour).";
  }

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (
    startMinutes != null &&
    endMinutes != null &&
    endMinutes <= startMinutes &&
    !errors.startTime &&
    !errors.endTime
  ) {
    errors.endTime = "End time must be after start time.";
  }

  if (!timezone) {
    errors.timezone = "Timezone is required.";
  }

  const windows: CleanerAvailabilityWindow[] = workingDays.map((dayOfWeek) => ({
    dayOfWeek,
    startTime: normalizeTimeForDb(startTime),
    endTime: normalizeTimeForDb(endTime),
    timezone: timezone || CLEANER_AVAILABILITY_TIMEZONE_DEFAULT,
  }));

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    windows,
  };
}

export type CleanerAvailabilityRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
};

/** Form values when editing an existing cleaner (empty DB rows → no days pre-selected). */
export function availabilityRowsToFormValues(rows: CleanerAvailabilityRow[]): CleanerAvailabilityFormValues {
  if (rows.length === 0) {
    return {
      workingDays: [],
      startTime: CLEANER_AVAILABILITY_DEFAULT_START,
      endTime: CLEANER_AVAILABILITY_DEFAULT_END,
      timezone: CLEANER_AVAILABILITY_TIMEZONE_DEFAULT,
    };
  }
  const first = rows[0]!;
  return {
    workingDays: [...new Set(rows.map((r) => r.day_of_week))].sort((a, b) => a - b),
    startTime: formatTimeForInput(first.start_time),
    endTime: formatTimeForInput(first.end_time),
    timezone: first.timezone || CLEANER_AVAILABILITY_TIMEZONE_DEFAULT,
  };
}

function formatDayRangeShort(sortedDays: number[]): string {
  if (sortedDays.length === 0) return "";
  if (sortedDays.length === 7) return "Sun–Sat";

  const groups: number[][] = [];
  let group: number[] = [sortedDays[0]!];

  for (let i = 1; i < sortedDays.length; i++) {
    const day = sortedDays[i]!;
    const prev = sortedDays[i - 1]!;
    if (day === prev + 1) {
      group.push(day);
    } else {
      groups.push(group);
      group = [day];
    }
  }
  groups.push(group);

  return groups
    .map((g) => {
      if (g.length === 1) return DAY_SHORT_BY_VALUE[g[0]!] ?? String(g[0]);
      if (g.length === 2) {
        return `${DAY_SHORT_BY_VALUE[g[0]!] ?? g[0]}, ${DAY_SHORT_BY_VALUE[g[1]!] ?? g[1]}`;
      }
      const first = DAY_SHORT_BY_VALUE[g[0]!] ?? String(g[0]);
      const last = DAY_SHORT_BY_VALUE[g[g.length - 1]!] ?? String(g[g.length - 1]);
      return `${first}–${last}`;
    })
    .join(", ");
}

/**
 * Human-readable summary for admin cleaner detail, e.g. "Available Mon–Sat, 07:00–18:00".
 */
export function formatCleanerAvailabilitySummary(rows: CleanerAvailabilityRow[]): string {
  if (rows.length === 0) {
    return "No working hours set";
  }

  const days = [...new Set(rows.map((r) => r.day_of_week))].sort((a, b) => a - b);
  const first = rows[0]!;
  const start = formatTimeForInput(first.start_time);
  const end = formatTimeForInput(first.end_time);
  const dayPart = formatDayRangeShort(days);

  return `Available ${dayPart}, ${start}–${end}`;
}

export function readWorkingDaysFromPayload(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const days: number[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    if (typeof item === "number" && Number.isInteger(item) && item >= 0 && item <= 6) {
      if (!seen.has(item)) {
        seen.add(item);
        days.push(item);
      }
    }
  }
  return days;
}
