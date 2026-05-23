import type { PricingFrequency } from "@/features/pricing/server/types";
import { WIZARD_TIMEZONE } from "@/features/booking-wizard/constants";
import {
  formatAdminRecurringScheduleSummary,
  type AdminRecurringScheduleMetadata,
} from "@/features/admin-booking-wizard/adminRecurringSchedule";
import { readBookingFrequencyFromMetadata } from "@/features/recurring/readBookingCadence";
import {
  formatSelectedDaysShort,
  readSelectedDaysFromBookingMetadata,
} from "@/features/recurring/recurringScheduleDays";
import type { Json } from "@/lib/database/types";

export type ParsedAdminBookingRecurringSchedule = {
  recurringEnabled: boolean;
  pricingFrequency: PricingFrequency;
  selectedDays: number[];
  intervalWeeks: number | null;
  configuredVia: AdminRecurringScheduleMetadata["configuredVia"] | null;
  scheduleSummaryLabel: string | null;
  cadenceLabel: string | null;
  selectedDaysLabel: string | null;
};

function asRecord(metadata: Json | null | undefined): Record<string, unknown> {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function readRecurringScheduleRecord(
  metadata: Json | null | undefined,
): AdminRecurringScheduleMetadata | null {
  const schedule = asRecord(metadata).recurringSchedule;
  if (schedule == null || typeof schedule !== "object" || Array.isArray(schedule)) {
    return null;
  }
  const row = schedule as Record<string, unknown>;
  const rawDays = row.selectedDays;
  if (!Array.isArray(rawDays) || rawDays.length === 0) return null;

  const selectedDays = rawDays
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  if (selectedDays.length === 0) return null;

  const configuredVia = row.configuredVia;
  if (configuredVia !== "admin_wizard_custom" && configuredVia !== "admin_wizard_preset") {
    return null;
  }

  const intervalWeeks =
    typeof row.intervalWeeks === "number" && Number.isInteger(row.intervalWeeks)
      ? row.intervalWeeks
      : undefined;

  return {
    selectedDays,
    ...(intervalWeeks !== undefined ? { intervalWeeks } : {}),
    configuredVia,
  };
}

function formatScheduleTimeFromIso(scheduledStart: string | null | undefined): string | undefined {
  if (!scheduledStart?.trim()) return undefined;
  const date = new Date(scheduledStart);
  if (!Number.isFinite(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: WIZARD_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function resolveWizardFrequencyForSummary(input: {
  pricingFrequency: PricingFrequency;
  recurringSchedule: AdminRecurringScheduleMetadata | null;
}): "once" | "weekly" | "biweekly" | "monthly" | "custom" {
  if (input.pricingFrequency === "once" || input.pricingFrequency === "monthly") {
    return input.pricingFrequency;
  }
  if (input.recurringSchedule?.configuredVia === "admin_wizard_custom") {
    return "custom";
  }
  return input.pricingFrequency;
}

function resolveIntervalWeeks(input: {
  pricingFrequency: PricingFrequency;
  recurringSchedule: AdminRecurringScheduleMetadata | null;
}): number {
  if (input.recurringSchedule?.intervalWeeks !== undefined) {
    return input.recurringSchedule.intervalWeeks;
  }
  if (input.pricingFrequency === "biweekly") return 2;
  return 1;
}

function cadenceLabelFromFrequency(frequency: PricingFrequency, intervalWeeks: number | null): string | null {
  if (frequency === "once") return null;
  if (frequency === "monthly") return "Monthly";
  if (frequency === "biweekly" || intervalWeeks === 2) return "Bi-weekly";
  if (frequency === "weekly" || intervalWeeks === 1) return "Weekly";
  return null;
}

const RECURRING_PARSE_CACHE_MAX = 256;
const recurringParseCache = new Map<string, ParsedAdminBookingRecurringSchedule>();

function recurringMetadataCacheKey(metadata: Json | null | undefined, scheduledStart?: string | null): string {
  const record = asRecord(metadata);
  const schedule = record.recurringSchedule;
  const frequency = record.frequency ?? record.pricingFrequency;
  return JSON.stringify({ frequency, schedule, scheduledStart: scheduledStart ?? null });
}

/** Display-only recurring schedule parsed from persisted booking metadata. */
export function parseAdminBookingRecurringScheduleFromMetadata(
  metadata: Json | null | undefined,
  scheduledStart?: string | null,
): ParsedAdminBookingRecurringSchedule {
  const cacheKey = recurringMetadataCacheKey(metadata, scheduledStart);
  const cached = recurringParseCache.get(cacheKey);
  if (cached) return cached;

  const pricingFrequency = readBookingFrequencyFromMetadata(metadata ?? ({} as Json));
  const recurringSchedule = readRecurringScheduleRecord(metadata);
  const selectedDaysFromMeta = readSelectedDaysFromBookingMetadata(metadata);
  const selectedDays = selectedDaysFromMeta ?? recurringSchedule?.selectedDays ?? [];

  const recurringEnabled =
    pricingFrequency !== "once" &&
    (selectedDays.length > 0 || pricingFrequency === "monthly");

  const intervalWeeks =
    recurringSchedule?.intervalWeeks ??
    (pricingFrequency === "biweekly" ? 2 : pricingFrequency === "weekly" ? 1 : null);

  const wizardFrequency = resolveWizardFrequencyForSummary({ pricingFrequency, recurringSchedule });
  const scheduleSummaryLabel =
    recurringEnabled && selectedDays.length > 0
      ? formatAdminRecurringScheduleSummary({
          frequency: wizardFrequency,
          recurringDays: selectedDays,
          recurringIntervalWeeks: resolveIntervalWeeks({ pricingFrequency, recurringSchedule }),
          time: formatScheduleTimeFromIso(scheduledStart),
        })
      : pricingFrequency === "monthly"
        ? "Monthly recurring visit"
        : null;

  const result = {
    recurringEnabled,
    pricingFrequency,
    selectedDays,
    intervalWeeks,
    configuredVia: recurringSchedule?.configuredVia ?? null,
    scheduleSummaryLabel,
    cadenceLabel: cadenceLabelFromFrequency(pricingFrequency, intervalWeeks),
    selectedDaysLabel: selectedDays.length > 0 ? formatSelectedDaysShort(selectedDays) : null,
  };

  if (recurringParseCache.size >= RECURRING_PARSE_CACHE_MAX) {
    const firstKey = recurringParseCache.keys().next().value;
    if (firstKey) recurringParseCache.delete(firstKey);
  }
  recurringParseCache.set(cacheKey, result);
  return result;
}

export function adminBookingRecurringHeroLabel(
  metadata: Json | null | undefined,
  scheduledStart?: string | null,
): string | null {
  const parsed = parseAdminBookingRecurringScheduleFromMetadata(metadata, scheduledStart);
  return parsed.scheduleSummaryLabel ?? parsed.cadenceLabel;
}
