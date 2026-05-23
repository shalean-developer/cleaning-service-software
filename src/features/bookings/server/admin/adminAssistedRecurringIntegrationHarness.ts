import type { AdminCreateBookingDraftBody } from "./parseAdminCreateBookingDraftBody";
import type { AdminRecurringScheduleMetadata } from "@/features/admin-booking-wizard/adminRecurringSchedule";

export function futureAdminAssistSchedule() {
  const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  start.setUTCHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  return { scheduledStart: start.toISOString(), scheduledEnd: end.toISOString() };
}

export type RecurringDraftScenario = {
  label: string;
  pricingFrequency: "weekly" | "biweekly";
  recurringSchedule: AdminRecurringScheduleMetadata;
};

export const ADMIN_ASSIST_RECURRING_DRAFT_SCENARIOS: RecurringDraftScenario[] = [
  {
    label: "weekly preset with selectedDays",
    pricingFrequency: "weekly",
    recurringSchedule: {
      selectedDays: [1],
      configuredVia: "admin_wizard_preset",
    },
  },
  {
    label: "custom Mon + Thu weekly",
    pricingFrequency: "weekly",
    recurringSchedule: {
      selectedDays: [1, 4],
      intervalWeeks: 1,
      configuredVia: "admin_wizard_custom",
    },
  },
  {
    label: "custom every 2 weeks Friday",
    pricingFrequency: "biweekly",
    recurringSchedule: {
      selectedDays: [5],
      intervalWeeks: 2,
      configuredVia: "admin_wizard_custom",
    },
  },
];

export function buildRecurringAdminAssistDraftBody(
  scenario: RecurringDraftScenario,
  idempotencyKey: string,
): AdminCreateBookingDraftBody {
  const schedule = futureAdminAssistSchedule();
  return {
    customerId: "11111111-1111-4111-8111-111111111111",
    idempotencyKey,
    scheduledStart: schedule.scheduledStart,
    scheduledEnd: schedule.scheduledEnd,
    pricingInput: {
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      frequency: scenario.pricingFrequency,
    },
    recurringSchedule: scenario.recurringSchedule,
    address: {
      addressLine1: "12 Main Rd",
      suburb: "Sea Point",
      city: "Cape Town",
    },
    cleanerPreferenceMode: "best_available",
  };
}

export function readRecurringScheduleFromBookingMetadata(
  metadata: unknown,
): AdminRecurringScheduleMetadata | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const schedule = (metadata as Record<string, unknown>).recurringSchedule;
  if (schedule == null || typeof schedule !== "object" || Array.isArray(schedule)) {
    return null;
  }
  const row = schedule as Record<string, unknown>;
  const selectedDays = Array.isArray(row.selectedDays)
    ? row.selectedDays.map((value) => Number(value)).filter((value) => Number.isInteger(value))
    : [];
  if (selectedDays.length === 0) return null;
  const configuredVia = row.configuredVia;
  if (configuredVia !== "admin_wizard_custom" && configuredVia !== "admin_wizard_preset") {
    return null;
  }
  return {
    selectedDays,
    ...(typeof row.intervalWeeks === "number" ? { intervalWeeks: row.intervalWeeks } : {}),
    configuredVia,
  };
}

export type SimulatedRecurringMaterialization = {
  bookingId: string;
  selectedDays: number[];
  groupId: string | null;
  seriesIds: string[];
};

export function simulateRecurringMaterialization(
  backend: {
    bookings: Map<string, { id: string; series_id: string | null; metadata: unknown }>;
  },
  booking: { id: string; metadata: unknown },
): SimulatedRecurringMaterialization | null {
  const schedule = readRecurringScheduleFromBookingMetadata(booking.metadata);
  if (!schedule) return null;

  const seriesId = `series-${booking.id.replace(/-/g, "").slice(0, 8)}`;
  const groupId =
    schedule.selectedDays.length > 1
      ? `group-${booking.id.replace(/-/g, "").slice(0, 8)}`
      : null;
  const seriesIds =
    schedule.selectedDays.length > 1
      ? schedule.selectedDays.map(
          (day) => `series-${booking.id.replace(/-/g, "").slice(0, 8)}-${day}`,
        )
      : [seriesId];

  const existing = backend.bookings.get(booking.id);
  if (existing) {
    backend.bookings.set(booking.id, { ...existing, series_id: seriesId });
  }

  return {
    bookingId: booking.id,
    selectedDays: schedule.selectedDays,
    groupId,
    seriesIds,
  };
}
