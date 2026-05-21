import "server-only";

import type { BookingSeriesRow, RecurringScheduleGroupRow } from "@/lib/database/types";
import { formatScheduleRange, serviceLabelFromSlug } from "@/features/dashboards/server/parseBookingDisplay";
import { recurringFrequencyLabel, recurringSeriesStatusLabel } from "../recurringDisplay";
import { formatSelectedDaysShort } from "../recurringScheduleDays";
import type { AdminRecurringSeriesListItem } from "./recurringManagementTypes";

export type AdminRecurringScheduleGroupListItem = {
  groupId: string;
  frequency: "weekly" | "biweekly";
  frequencyLabel: string;
  status: RecurringScheduleGroupRow["status"];
  statusLabel: string;
  serviceLabel: string;
  selectedDaysLabel: string;
  activeSeriesCount: number;
  totalUnpaidChildren: number;
  totalPaidUpcoming: number;
  customerId: string;
  customerName: string;
  series: AdminRecurringSeriesListItem[];
};

export function buildAdminScheduleGroupListItem(input: {
  group: RecurringScheduleGroupRow;
  seriesRows: BookingSeriesRow[];
  seriesItems: AdminRecurringSeriesListItem[];
  customer: { name: string };
}): AdminRecurringScheduleGroupListItem {
  const activeSeriesCount = input.seriesItems.filter((s) => s.status === "active").length;
  return {
    groupId: input.group.id,
    frequency: input.group.frequency,
    frequencyLabel: recurringFrequencyLabel(input.group.frequency),
    status: input.group.status,
    statusLabel: recurringSeriesStatusLabel(input.group.status),
    serviceLabel: serviceLabelFromSlug(input.group.service_slug),
    selectedDaysLabel: formatSelectedDaysShort(input.group.selected_days),
    activeSeriesCount,
    totalUnpaidChildren: input.seriesItems.reduce((n, s) => n + (s.nextOccurrencePaymentRequired ? 1 : 0), 0),
    totalPaidUpcoming: 0,
    customerId: input.group.customer_id,
    customerName: input.customer.name,
    series: input.seriesItems,
  };
}

export type CustomerRecurringScheduleGroupListItem = {
  groupId: string;
  frequencyLabel: string;
  statusLabel: string;
  serviceLabel: string;
  selectedDaysLabel: string;
  sharedTimeLabel: string | null;
  nextVisitsSummary: string;
  unpaidUpcomingCount: number;
  series: import("./recurringManagementTypes").CustomerRecurringSeriesListItem[];
};

export function buildCustomerScheduleGroupListItem(input: {
  group: RecurringScheduleGroupRow;
  seriesItems: import("./recurringManagementTypes").CustomerRecurringSeriesListItem[];
  sharedTimeLabel: string | null;
}): CustomerRecurringScheduleGroupListItem {
  const unpaidUpcomingCount = input.seriesItems.reduce((n, s) => n + s.unpaidChildCount, 0);
  const nextLabels = input.seriesItems
    .map((s) => s.nextOccurrenceScheduleLabel)
    .filter((l): l is string => Boolean(l))
    .slice(0, 3);
  return {
    groupId: input.group.id,
    frequencyLabel: recurringFrequencyLabel(input.group.frequency),
    statusLabel: recurringSeriesStatusLabel(input.group.status),
    serviceLabel: serviceLabelFromSlug(input.group.service_slug),
    selectedDaysLabel: formatSelectedDaysShort(input.group.selected_days),
    sharedTimeLabel: input.sharedTimeLabel,
    nextVisitsSummary: nextLabels.length > 0 ? nextLabels.join(" · ") : "To be scheduled",
    unpaidUpcomingCount,
    series: input.seriesItems,
  };
}

export function sharedTimeLabelFromSeries(
  seriesRows: BookingSeriesRow[],
): string | null {
  const first = seriesRows[0];
  if (!first?.anchor_scheduled_start) return null;
  return formatScheduleRange(first.anchor_scheduled_start, first.anchor_scheduled_start).split("–")[0]?.trim() ?? null;
}
