import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import type { Json } from "@/lib/database/types";
import type {
  BookingSupportRequestRow,
  BookingSupportRequestStatus,
  BookingSupportRequestType,
  PaymentStatus,
  RecurringSeriesRequestRow,
  RecurringSeriesRequestStatus,
  RecurringSeriesRequestType,
} from "@/lib/database/types";
import { formatBookingReferenceLabel } from "@/lib/app/paymentFailedPage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  labelForBookingSupportRequestStatus,
  labelForBookingSupportRequestType,
} from "@/features/bookings/server/bookingSupportRequestTypes";
import { parseBookingDisplay } from "@/features/dashboards/server/parseBookingDisplay";
import { recurringFrequencyLabel } from "@/features/recurring/recurringDisplay";
import { ARCHIVED_CUSTOMER_LABEL } from "@/features/recurring/server/recurringReadModelLabels";
import {
  suggestedNextActionForBookingRequest,
  suggestedNextActionForRecurringRequest,
} from "./supportInboxTriage";
import { computeSupportRequestStaleFlags } from "./supportRequestStale";
import {
  supportRequestPriority,
  supportRequestUrgencyReason,
  type SupportRequestPriority,
} from "./supportRequestPriority";
import { supportRequestSlaStatus, type SupportAgeBucket, type SupportSlaStatus } from "./supportRequestSla";
import type { SupportSlaCategory } from "./supportRequestPriority";
import {
  supportPaymentRisk,
  supportTriageLabel,
  upcomingVisitHoursFromScheduledStart,
  type SupportTriageLabel,
} from "./supportTriageIntelligence";
import {
  buildSupportEscalationContext,
  detectSupportEscalations,
} from "./supportEscalation";
import { buildAdminSupportRequestHistory } from "./supportRequestHistory";
import {
  buildSupportOperationsSnapshot,
  filterItemsByOperationsView,
  type SupportOperationsSnapshot,
} from "./supportOperationsReadModel";

export type AdminSupportInboxSource = "booking_support" | "recurring_support";
export type AdminSupportInboxPriority = SupportRequestPriority;
export type AdminSupportInboxFilter =
  | "all"
  | "open"
  | "urgent"
  | "booking"
  | "recurring"
  | "resolved"
  | "needs_attention"
  | "aging"
  | "breached"
  | "payment_issues"
  | "cleaner_service"
  | "recently_resolved";

export type AdminSupportInboxItem = {
  id: string;
  source: AdminSupportInboxSource;
  requestType: string;
  requestTypeLabel: string;
  status: string;
  statusLabel: string;
  priority: AdminSupportInboxPriority;
  messagePreview: string | null;
  preferredNewTime: string | null;
  createdAt: string;
  resolvedAt: string | null;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  bookingId: string | null;
  bookingReference: string | null;
  bookingStatus: string | null;
  paymentStatus: string | null;
  scheduledStart: string | null;
  serviceLabel: string | null;
  addressSummary: string | null;
  seriesId: string | null;
  groupId: string | null;
  frequencyLabel: string | null;
  targetWeekdayLabel: string | null;
  bookingHref: string | null;
  seriesHref: string | null;
  groupHref: string | null;
  suggestedNextAction: string;
  canAcknowledge: boolean;
  canResolve: boolean;
  canReject: boolean;
  staleOpen24h: boolean;
  staleAcknowledged48h: boolean;
  updatedAt: string;
  slaCategory: SupportSlaCategory;
  slaStatus: SupportSlaStatus;
  ageBucket: SupportAgeBucket;
  ageMinutes: number;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  timeToFirstResponseMinutes: number | null;
  timeToResolutionMinutes: number | null;
  urgencyReason: string | null;
  triageLabel: SupportTriageLabel | null;
  escalationReasons: string[];
  cleanerId: string | null;
  cleanerLabel: string | null;
  suburb: string | null;
  paymentRisk: boolean;
  upcomingVisitHours: number | null;
  customerResponse: string | null;
  respondedAt: string | null;
  adminNotes: string | null;
  resolvedBy: string | null;
};

export type AdminSupportInboxSummary = {
  open: number;
  urgent: number;
  acknowledged: number;
  resolvedToday: number;
  staleOpen24h: number;
  staleAcknowledged48h: number;
  slaBreached: number;
  escalationCount: number;
  avgAcknowledgeMinutes: number | null;
  avgResolveMinutes: number | null;
};

export type AdminSupportInboxResult = {
  items: AdminSupportInboxItem[];
  summary: AdminSupportInboxSummary;
  operations: SupportOperationsSnapshot;
  filter: AdminSupportInboxFilter;
};

const WIZARD_TIMEZONE = "Africa/Johannesburg";

const RECURRING_REQUEST_TYPE_LABELS: Record<RecurringSeriesRequestType, string> = {
  pause: "Pause",
  cancel: "Cancel",
  reschedule: "Reschedule",
  pause_group: "Pause entire schedule",
  cancel_group: "Cancel entire schedule",
  reschedule_group: "Reschedule entire schedule",
  pause_weekday: "Pause weekday",
  cancel_weekday: "Cancel weekday",
  reschedule_weekday: "Reschedule weekday",
};

const RECURRING_STATUS_LABELS: Record<RecurringSeriesRequestStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  rejected: "Rejected",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function priorityRank(p: AdminSupportInboxPriority): number {
  if (p === "urgent") return 0;
  if (p === "normal") return 1;
  return 2;
}

function johannesburgTodayKey(reference = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIZARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(reference);
}

function isResolvedToday(resolvedAt: string | null): boolean {
  if (!resolvedAt) return false;
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: WIZARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(resolvedAt));
  return day === johannesburgTodayKey();
}

function isOpenStatus(status: string): boolean {
  return status === "open" || status === "acknowledged";
}

function readRequestedDateTime(metadata: Record<string, unknown>): string | null {
  const v = metadata.requestedDateTimeIso;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function weekdayLabel(weekday: number | null): string | null {
  if (weekday == null || weekday < 0 || weekday > 6) return null;
  return WEEKDAY_LABELS[weekday] ?? String(weekday);
}

async function loadCustomerLabels(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  customerIds: string[],
): Promise<Map<string, { name: string; email: string | null; phone: string | null }>> {
  const map = new Map<string, { name: string; email: string | null; phone: string | null }>();
  if (customerIds.length === 0) return map;

  const { data: customers, error } = await client
    .from("customers")
    .select("id, profile_id, company_name, phone")
    .in("id", customerIds);
  if (error) throw new Error(error.message);

  const profileIds = (customers ?? [])
    .map((c) => c.profile_id)
    .filter((id): id is string => Boolean(id));

  const profileNames = new Map<string, string | null>();
  if (profileIds.length > 0) {
    const { data: profiles } = await client
      .from("profiles")
      .select("id, full_name")
      .in("id", profileIds);
    for (const p of profiles ?? []) {
      profileNames.set(p.id, p.full_name?.trim() ?? null);
    }
  }

  for (const c of customers ?? []) {
    const profileName = c.profile_id ? profileNames.get(c.profile_id) : null;
    const name =
      c.company_name?.trim() ||
      profileName ||
      `${ARCHIVED_CUSTOMER_LABEL} ${(c.id as string).slice(0, 8)}`;
    map.set(c.id as string, {
      name,
      email: null,
      phone: c.phone?.trim() ?? null,
    });
  }

  return map;
}

type BookingContext = {
  id: string;
  status: string;
  scheduled_start: string;
  cleaner_id: string | null;
  metadata: Json;
};

async function loadBookingContexts(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  bookingIds: string[],
): Promise<Map<string, BookingContext & { paymentStatus: PaymentStatus | null }>> {
  const map = new Map<string, BookingContext & { paymentStatus: PaymentStatus | null }>();
  if (bookingIds.length === 0) return map;

  const { data: bookings, error } = await client
    .from("bookings")
    .select("id, status, scheduled_start, cleaner_id, metadata")
    .in("id", bookingIds);
  if (error) throw new Error(error.message);

  const { data: payments } = await client
    .from("payments")
    .select("booking_id, status, updated_at")
    .in("booking_id", bookingIds)
    .order("updated_at", { ascending: false });

  const paymentByBooking = new Map<string, PaymentStatus>();
  for (const p of payments ?? []) {
    if (!p.booking_id || paymentByBooking.has(p.booking_id)) continue;
    paymentByBooking.set(p.booking_id, p.status as PaymentStatus);
  }

  for (const b of bookings ?? []) {
    map.set(b.id as string, {
      id: b.id as string,
      status: b.status as string,
      scheduled_start: b.scheduled_start as string,
      cleaner_id: (b.cleaner_id as string | null) ?? null,
      metadata: b.metadata as Json,
      paymentStatus: paymentByBooking.get(b.id as string) ?? null,
    });
  }

  return map;
}

async function loadCleanerLabels(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  cleanerIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (cleanerIds.length === 0) return map;

  const { data: cleaners, error } = await client
    .from("cleaners")
    .select("id, profile_id")
    .in("id", cleanerIds);
  if (error) return map;

  const profileIds = (cleaners ?? [])
    .map((c) => c.profile_id)
    .filter((id): id is string => Boolean(id));

  const profileNames = new Map<string, string | null>();
  if (profileIds.length > 0) {
    const { data: profiles } = await client
      .from("profiles")
      .select("id, full_name")
      .in("id", profileIds);
    for (const p of profiles ?? []) {
      profileNames.set(p.id, p.full_name?.trim() ?? null);
    }
  }

  for (const c of cleaners ?? []) {
    const name = c.profile_id ? profileNames.get(c.profile_id) : null;
    map.set(c.id as string, name ?? `Cleaner ${(c.id as string).slice(0, 8)}`);
  }

  return map;
}

function enrichInboxItem(
  base: Omit<
    AdminSupportInboxItem,
    | "slaCategory"
    | "slaStatus"
    | "ageBucket"
    | "ageMinutes"
    | "firstResponseDueAt"
    | "resolutionDueAt"
    | "timeToFirstResponseMinutes"
    | "timeToResolutionMinutes"
    | "urgencyReason"
    | "triageLabel"
    | "escalationReasons"
    | "cleanerId"
    | "cleanerLabel"
    | "suburb"
    | "paymentRisk"
    | "upcomingVisitHours"
    | "customerResponse"
    | "respondedAt"
    | "adminNotes"
    | "resolvedBy"
    | "updatedAt"
  >,
  input: {
    updatedAt: string;
    requestedDateTimeIso: string | null;
    customerResponse: string | null;
    respondedAt: string | null;
    adminNotes: string | null;
    resolvedBy: string | null;
    cleanerId: string | null;
    cleanerLabel: string | null;
    suburb: string | null;
  },
): AdminSupportInboxItem {
  const acknowledgedAt =
    base.status === "acknowledged" || base.status === "resolved" || base.status === "rejected"
      ? input.respondedAt ?? input.updatedAt
      : null;

  const sla = supportRequestSlaStatus({
    status: base.status,
    requestType: base.requestType,
    createdAt: base.createdAt,
    updatedAt: input.updatedAt,
    acknowledgedAt,
    resolvedAt: base.resolvedAt,
    scheduledStart: base.scheduledStart,
    requestedDateTimeIso: input.requestedDateTimeIso,
  });

  const paymentRisk = supportPaymentRisk(base.paymentStatus);
  const upcomingVisitHours = upcomingVisitHoursFromScheduledStart(base.scheduledStart);

  const triageLabel = supportTriageLabel({
    status: base.status,
    slaStatus: sla.slaStatus,
    paymentRisk,
    upcomingVisitHours,
    customerResponse: input.customerResponse,
    respondedAt: input.respondedAt,
  });

  return {
    ...base,
    updatedAt: input.updatedAt,
    slaCategory: sla.slaCategory,
    slaStatus: sla.slaStatus,
    ageBucket: sla.ageBucket,
    ageMinutes: sla.ageMinutes,
    firstResponseDueAt: sla.firstResponseDueAt,
    resolutionDueAt: sla.resolutionDueAt,
    timeToFirstResponseMinutes: sla.timeToFirstResponseMinutes,
    timeToResolutionMinutes: sla.timeToResolutionMinutes,
    urgencyReason: supportRequestUrgencyReason({
      status: base.status,
      requestType: base.requestType,
      createdAt: base.createdAt,
      scheduledStart: base.scheduledStart,
      requestedDateTimeIso: input.requestedDateTimeIso,
    }),
    triageLabel,
    escalationReasons: [],
    cleanerId: input.cleanerId,
    cleanerLabel: input.cleanerLabel,
    suburb: input.suburb,
    paymentRisk,
    upcomingVisitHours,
    customerResponse: input.customerResponse,
    respondedAt: input.respondedAt,
    adminNotes: input.adminNotes,
    resolvedBy: input.resolvedBy,
  };
}

async function loadSeriesFrequency(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  seriesIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (seriesIds.length === 0) return map;
  const { data, error } = await client
    .from("booking_series")
    .select("id, frequency")
    .in("id", seriesIds);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const freq = row.frequency as "weekly" | "biweekly" | "monthly";
    map.set(row.id as string, recurringFrequencyLabel(freq));
  }
  return map;
}

function mapBookingRequest(
  row: BookingSupportRequestRow,
  customer: { name: string; email: string | null; phone: string | null } | undefined,
  booking: (BookingContext & { paymentStatus: PaymentStatus | null }) | undefined,
): AdminSupportInboxItem {
  const display = booking ? parseBookingDisplay(booking.metadata) : null;
  const requestType = row.request_type as BookingSupportRequestType;
  const status = row.status as BookingSupportRequestStatus;
  const priority = supportRequestPriority({
    status,
    requestType,
    createdAt: row.created_at,
    scheduledStart: booking?.scheduled_start ?? null,
    requestedDateTimeIso: null,
  });
  const stale = computeSupportRequestStaleFlags({
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const addressParts = [display?.suburb, display?.city].filter(Boolean);
  const suburb = display?.suburb?.trim() || null;
  const addressSummary =
    addressParts.length > 0
      ? addressParts.join(", ")
      : display?.locationSummary?.trim() || null;

  const base: Omit<
    AdminSupportInboxItem,
    | "slaCategory"
    | "slaStatus"
    | "ageBucket"
    | "ageMinutes"
    | "firstResponseDueAt"
    | "resolutionDueAt"
    | "timeToFirstResponseMinutes"
    | "timeToResolutionMinutes"
    | "urgencyReason"
    | "triageLabel"
    | "escalationReasons"
    | "cleanerId"
    | "cleanerLabel"
    | "suburb"
    | "paymentRisk"
    | "upcomingVisitHours"
    | "customerResponse"
    | "respondedAt"
    | "adminNotes"
    | "resolvedBy"
    | "updatedAt"
  > = {
    id: row.id,
    source: "booking_support",
    requestType,
    requestTypeLabel: labelForBookingSupportRequestType(requestType),
    status,
    statusLabel: labelForBookingSupportRequestStatus(status),
    priority,
    messagePreview: row.message?.trim() || null,
    preferredNewTime: row.preferred_new_time,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    customerId: row.customer_id,
    customerName: customer?.name ?? ARCHIVED_CUSTOMER_LABEL,
    customerEmail: customer?.email ?? null,
    customerPhone: customer?.phone ?? null,
    bookingId: row.booking_id,
    bookingReference: formatBookingReferenceLabel(row.booking_id),
    bookingStatus: booking?.status ?? null,
    paymentStatus: booking?.paymentStatus ?? null,
    scheduledStart: booking?.scheduled_start ?? null,
    serviceLabel: display?.serviceLabel ?? null,
    addressSummary,
    seriesId: null,
    groupId: null,
    frequencyLabel: null,
    targetWeekdayLabel: null,
    bookingHref: `/admin/bookings/${row.booking_id}`,
    seriesHref: null,
    groupHref: null,
    suggestedNextAction: suggestedNextActionForBookingRequest(requestType),
    canAcknowledge: status === "open",
    canResolve: status === "open" || status === "acknowledged",
    canReject: status === "open" || status === "acknowledged",
    staleOpen24h: stale.staleOpen24h,
    staleAcknowledged48h: stale.staleAcknowledged48h,
  };

  return enrichInboxItem(base, {
    updatedAt: row.updated_at,
    requestedDateTimeIso: null,
    customerResponse: row.customer_response ?? null,
    respondedAt: row.responded_at ?? null,
    adminNotes: row.admin_notes ?? null,
    resolvedBy: row.resolved_by ?? null,
    cleanerId: booking?.cleaner_id ?? null,
    cleanerLabel: null,
    suburb,
  });
}

function mapRecurringRequest(
  row: RecurringSeriesRequestRow,
  customer: { name: string; email: string | null; phone: string | null } | undefined,
  frequencyLabel: string | null,
): AdminSupportInboxItem {
  const requestType = row.request_type as RecurringSeriesRequestType;
  const status = row.status as RecurringSeriesRequestStatus;
  const meta =
    row.metadata != null && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const requestedDateTimeIso = readRequestedDateTime(meta);

  const priority = supportRequestPriority({
    status,
    requestType,
    createdAt: row.created_at,
    scheduledStart: null,
    requestedDateTimeIso,
  });
  const stale = computeSupportRequestStaleFlags({
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  });

  const base: Omit<
    AdminSupportInboxItem,
    | "slaCategory"
    | "slaStatus"
    | "ageBucket"
    | "ageMinutes"
    | "firstResponseDueAt"
    | "resolutionDueAt"
    | "timeToFirstResponseMinutes"
    | "timeToResolutionMinutes"
    | "urgencyReason"
    | "triageLabel"
    | "escalationReasons"
    | "cleanerId"
    | "cleanerLabel"
    | "suburb"
    | "paymentRisk"
    | "upcomingVisitHours"
    | "customerResponse"
    | "respondedAt"
    | "adminNotes"
    | "resolvedBy"
    | "updatedAt"
  > = {
    id: row.id,
    source: "recurring_support",
    requestType,
    requestTypeLabel: RECURRING_REQUEST_TYPE_LABELS[requestType] ?? requestType,
    status,
    statusLabel: RECURRING_STATUS_LABELS[status] ?? status,
    priority,
    messagePreview: row.note?.trim() || null,
    preferredNewTime: requestedDateTimeIso,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    customerId: row.customer_id,
    customerName: customer?.name ?? ARCHIVED_CUSTOMER_LABEL,
    customerEmail: customer?.email ?? null,
    customerPhone: customer?.phone ?? null,
    bookingId: null,
    bookingReference: null,
    bookingStatus: null,
    paymentStatus: null,
    scheduledStart: null,
    serviceLabel: null,
    addressSummary: null,
    seriesId: row.series_id,
    groupId: row.group_id,
    frequencyLabel,
    targetWeekdayLabel: weekdayLabel(row.target_weekday),
    bookingHref: null,
    seriesHref: row.series_id ? `/admin/recurring/${row.series_id}` : null,
    groupHref: row.group_id ? `/admin/recurring/groups/${row.group_id}` : null,
    suggestedNextAction: suggestedNextActionForRecurringRequest(requestType),
    canAcknowledge: status === "open",
    canResolve: status === "open" || status === "acknowledged",
    canReject: status === "open" || status === "acknowledged",
    staleOpen24h: stale.staleOpen24h,
    staleAcknowledged48h: stale.staleAcknowledged48h,
  };

  return enrichInboxItem(base, {
    updatedAt: row.updated_at ?? row.created_at,
    requestedDateTimeIso,
    customerResponse: row.customer_response ?? null,
    respondedAt: row.responded_at ?? null,
    adminNotes: row.admin_notes ?? null,
    resolvedBy: row.resolved_by ?? null,
    cleanerId: null,
    cleanerLabel: null,
    suburb: null,
  });
}

function buildSummary(
  items: AdminSupportInboxItem[],
  operations: SupportOperationsSnapshot,
): AdminSupportInboxSummary {
  let open = 0;
  let urgent = 0;
  let acknowledged = 0;
  let resolvedToday = 0;
  let staleOpen24h = 0;
  let staleAcknowledged48h = 0;

  for (const item of items) {
    if (item.status === "open") open += 1;
    if (item.status === "acknowledged") acknowledged += 1;
    if (isOpenStatus(item.status) && item.priority === "urgent") urgent += 1;
    if (item.staleOpen24h) staleOpen24h += 1;
    if (item.staleAcknowledged48h) staleAcknowledged48h += 1;
    if (
      (item.status === "resolved" || item.status === "rejected") &&
      isResolvedToday(item.resolvedAt)
    ) {
      resolvedToday += 1;
    }
  }

  return {
    open,
    urgent,
    acknowledged,
    resolvedToday,
    staleOpen24h,
    staleAcknowledged48h,
    slaBreached: operations.slaBreached,
    escalationCount: operations.escalationCount,
    avgAcknowledgeMinutes: operations.avgAcknowledgeMinutes,
    avgResolveMinutes: operations.avgResolveMinutes,
  };
}

function applyFilter(items: AdminSupportInboxItem[], filter: AdminSupportInboxFilter): AdminSupportInboxItem[] {
  switch (filter) {
    case "open":
      return items.filter((i) => i.status === "open");
    case "urgent":
      return items.filter((i) => isOpenStatus(i.status) && i.priority === "urgent");
    case "booking":
      return items.filter((i) => i.source === "booking_support");
    case "recurring":
      return items.filter((i) => i.source === "recurring_support");
    case "resolved":
      return items.filter((i) => i.status === "resolved" || i.status === "rejected");
    case "needs_attention":
    case "aging":
    case "breached":
    case "payment_issues":
    case "cleaner_service":
    case "recently_resolved":
      return filterItemsByOperationsView(items, filter);
    default:
      return items;
  }
}

function applySearch(items: AdminSupportInboxItem[], search: string | null | undefined): AdminSupportInboxItem[] {
  const q = search?.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const haystack = [
      item.customerName,
      item.customerPhone ?? "",
      item.customerEmail ?? "",
      item.bookingReference ?? "",
      item.bookingId ?? "",
      item.addressSummary ?? "",
      item.requestType,
      item.requestTypeLabel,
      item.messagePreview ?? "",
      item.frequencyLabel ?? "",
      item.targetWeekdayLabel ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

function sortItems(items: AdminSupportInboxItem[]): AdminSupportInboxItem[] {
  const slaRank = (s: SupportSlaStatus) => (s === "breached" ? 0 : s === "warning" ? 1 : 2);
  return [...items].sort((a, b) => {
    const sr = slaRank(a.slaStatus) - slaRank(b.slaStatus);
    if (sr !== 0) return sr;
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    if (b.escalationReasons.length !== a.escalationReasons.length) {
      return b.escalationReasons.length - a.escalationReasons.length;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function attachEscalations(items: AdminSupportInboxItem[]): AdminSupportInboxItem[] {
  const context = buildSupportEscalationContext(
    items.map((item) => ({
      id: item.id,
      source: item.source,
      status: item.status,
      requestType: item.requestType,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      bookingId: item.bookingId,
      seriesId: item.seriesId,
      customerId: item.customerId,
      slaStatus: item.slaStatus,
      ageMinutes: item.ageMinutes,
      upcomingVisitHours: item.upcomingVisitHours,
    })),
  );

  return items.map((item) => ({
    ...item,
    escalationReasons: detectSupportEscalations(
      {
        id: item.id,
        source: item.source,
        status: item.status,
        requestType: item.requestType,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        bookingId: item.bookingId,
        seriesId: item.seriesId,
        customerId: item.customerId,
        slaStatus: item.slaStatus,
        ageMinutes: item.ageMinutes,
        upcomingVisitHours: item.upcomingVisitHours,
      },
      context,
    ),
  }));
}

export async function listAdminSupportInbox(
  user: CurrentUser,
  params: { filter?: AdminSupportInboxFilter; search?: string | null } = {},
): Promise<
  | { ok: true } & AdminSupportInboxResult
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      code: "AUTH_NOT_CONFIGURED",
      message: "Supabase not configured.",
      status: 503,
    };
  }

  const filter = params.filter ?? "all";

  let bookingRows: BookingSupportRequestRow[] = [];
  const bookingFull = await client
    .from("booking_support_requests")
    .select(
      "id, booking_id, customer_id, request_type, status, message, preferred_new_time, created_at, updated_at, resolved_at, resolved_by, customer_response, responded_at, admin_notes",
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (bookingFull.error) {
    const legacyBooking = await client
      .from("booking_support_requests")
      .select(
        "id, booking_id, customer_id, request_type, status, message, preferred_new_time, created_at, resolved_at",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (legacyBooking.error) {
      return {
        ok: false,
        code: "PERSISTENCE_ERROR",
        message: legacyBooking.error.message,
        status: 500,
      };
    }
    bookingRows = (legacyBooking.data ?? []).map((row) => ({
      ...(row as BookingSupportRequestRow),
      updated_at: row.created_at,
      customer_response: null,
      responded_at: null,
    }));
  } else {
    bookingRows = (bookingFull.data ?? []) as BookingSupportRequestRow[];
  }

  let recurringRows: RecurringSeriesRequestRow[] = [];
  const recurringFull = await client
    .from("recurring_series_requests")
    .select(
      "id, series_id, group_id, customer_id, request_type, scope, status, note, created_at, updated_at, resolved_at, resolved_by, target_weekday, metadata, customer_response, responded_at, admin_notes",
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (recurringFull.error) {
    const legacyRecurring = await client
      .from("recurring_series_requests")
      .select(
        "id, series_id, group_id, customer_id, request_type, scope, status, note, created_at, resolved_at, target_weekday, metadata",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (legacyRecurring.error) {
      return {
        ok: false,
        code: "PERSISTENCE_ERROR",
        message: legacyRecurring.error.message,
        status: 500,
      };
    }
    recurringRows = (legacyRecurring.data ?? []).map((row) => ({
      ...(row as RecurringSeriesRequestRow),
      updated_at: row.created_at,
      customer_response: null,
      responded_at: null,
    }));
  } else {
    recurringRows = (recurringFull.data ?? []) as RecurringSeriesRequestRow[];
  }

  const customerIds = [
    ...new Set([
      ...bookingRows.map((r) => r.customer_id),
      ...recurringRows.map((r) => r.customer_id),
    ]),
  ];
  const bookingIds = [...new Set(bookingRows.map((r) => r.booking_id))];
  const seriesIds = [
    ...new Set(recurringRows.map((r) => r.series_id).filter((id): id is string => Boolean(id))),
  ];

  const [customers, bookings, frequencies] = await Promise.all([
    loadCustomerLabels(client, customerIds),
    loadBookingContexts(client, bookingIds),
    loadSeriesFrequency(client, seriesIds),
  ]);

  const cleanerIds = [
    ...new Set(
      [...bookings.values()]
        .map((b) => b.cleaner_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const cleanerLabels = await loadCleanerLabels(client, cleanerIds);

  let allItems: AdminSupportInboxItem[] = [
    ...bookingRows.map((row) => {
      const item = mapBookingRequest(
        row,
        customers.get(row.customer_id),
        bookings.get(row.booking_id),
      );
      if (item.cleanerId) {
        return { ...item, cleanerLabel: cleanerLabels.get(item.cleanerId) ?? null };
      }
      return item;
    }),
    ...recurringRows.map((row) =>
      mapRecurringRequest(
        row,
        customers.get(row.customer_id),
        row.series_id ? (frequencies.get(row.series_id) ?? null) : null,
      ),
    ),
  ];

  allItems = attachEscalations(allItems);
  const operations = buildSupportOperationsSnapshot(allItems);
  const summary = buildSummary(allItems, operations);
  const filtered = applyFilter(allItems, filter);
  const searched = applySearch(filtered, params.search);
  const items = sortItems(searched);

  return { ok: true, items, summary, operations, filter };
}

export async function countAdminSupportInboxBadges(
  user: CurrentUser,
): Promise<{ open: number; urgent: number } | null> {
  const result = await listAdminSupportInbox(user, { filter: "all" });
  if (!result.ok) return null;
  return { open: result.summary.open, urgent: result.summary.urgent };
}

export { computeSupportInboxPriorityForTest } from "./supportRequestPriority";
export { buildAdminSupportRequestHistory } from "./supportRequestHistory";
