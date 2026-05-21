import type { BookingSeriesRow, RecurringScheduleGroupRow } from "@/lib/database/types";
import type { RecurringHealthAlert, RecurringHealthAlertCode } from "./recurringHealthTypes";

export function buildRecurringGroupIntegrityAlerts(input: {
  groups: RecurringScheduleGroupRow[];
  seriesRows: BookingSeriesRow[];
}): RecurringHealthAlert[] {
  const alerts: RecurringHealthAlert[] = [];
  const seriesByGroup = new Map<string, BookingSeriesRow[]>();

  for (const s of input.seriesRows) {
    if (!s.group_id) continue;
    const list = seriesByGroup.get(s.group_id) ?? [];
    list.push(s);
    seriesByGroup.set(s.group_id, list);
  }

  const groupIds = new Set(input.groups.map((g) => g.id));

  for (const s of input.seriesRows) {
    if (s.group_id && !groupIds.has(s.group_id)) {
      alerts.push({
        code: "ORPHAN_SERIES_GROUP",
        severity: "critical",
        message: `Series ${s.id} references missing group ${s.group_id}`,
        seriesId: s.id,
      });
    }
  }

  for (const g of input.groups) {
    const children = seriesByGroup.get(g.id) ?? [];
    if (children.length === 0) {
      alerts.push({
        code: "GROUP_NO_ACTIVE_SERIES",
        severity: "warning",
        message: `Group ${g.id} has no booking_series rows`,
        seriesId: undefined,
      });
    }
    if (g.status === "active" && children.every((c) => c.status !== "active")) {
      alerts.push({
        code: "GROUP_NO_ACTIVE_SERIES",
        severity: "warning",
        message: `Active group ${g.id} has no active series`,
        seriesId: undefined,
      });
    }
    if (g.status === "paused" && children.some((c) => c.status === "active")) {
      alerts.push({
        code: "GROUP_PAUSED_WITH_ACTIVE_SERIES",
        severity: "warning",
        message: `Paused group ${g.id} still has active series`,
        seriesId: undefined,
      });
    }
    if (g.status === "cancelled" && children.some((c) => c.status === "active" || c.status === "paused")) {
      alerts.push({
        code: "GROUP_CANCELLED_WITH_ACTIVE_SERIES",
        severity: "critical",
        message: `Cancelled group ${g.id} still has active or paused series`,
        seriesId: undefined,
      });
    }

    const weekdays = children.map((c) => c.weekday).filter((w): w is number => w != null);
    const dup = weekdays.find((w, i) => weekdays.indexOf(w) !== i);
    if (dup != null) {
      alerts.push({
        code: "GROUP_DUPLICATE_WEEKDAY",
        severity: "critical",
        message: `Group ${g.id} has duplicate weekday ${dup}`,
        seriesId: undefined,
      });
    }

    for (const s of children) {
      if (s.frequency !== g.frequency) {
        alerts.push({
          code: "GROUP_FREQUENCY_MISMATCH",
          severity: "critical",
          message: `Series ${s.id} frequency ${s.frequency} != group ${g.frequency}`,
          seriesId: s.id,
        });
      }
    }
  }

  return alerts;
}
