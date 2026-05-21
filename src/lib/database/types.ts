/**
 * Typed database plan aligned with `supabase/migrations/20260515201500_core_foundation.sql`.
 * Replace or extend with `supabase gen types` output when a live project is linked.
 */

import type { BookingCommandType } from "@/features/bookings/server/commands/types";
import type { BookingStatus } from "@/features/bookings/server/types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export const USER_ROLES = ["customer", "cleaner", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PAYMENT_STATUSES = [
  "initialized",
  "pending",
  "paid",
  "failed",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ASSIGNMENT_OFFER_STATUSES = [
  "offered",
  "accepted",
  "declined",
  "expired",
  "cancelled",
] as const;
export type AssignmentOfferStatus = (typeof ASSIGNMENT_OFFER_STATUSES)[number];

export const BOOKING_CLEANER_ROLES = ["primary", "support"] as const;
export type BookingCleanerRole = (typeof BOOKING_CLEANER_ROLES)[number];

export const BOOKING_CLEANER_STATUSES = [
  "planned",
  "offered",
  "accepted",
  "declined",
  "removed",
  "completed",
] as const;
export type BookingCleanerStatus = (typeof BOOKING_CLEANER_STATUSES)[number];

export const BOOKING_LOCK_STATUSES = ["active", "consumed", "expired"] as const;
export type BookingLockStatus = (typeof BOOKING_LOCK_STATUSES)[number];

export const NOTIFICATION_OUTBOX_STATUSES = [
  "pending",
  "processing",
  "sent",
  "failed",
] as const;
export type NotificationOutboxStatus = (typeof NOTIFICATION_OUTBOX_STATUSES)[number];

export type ProfileRow = {
  id: string;
  role: UserRole;
  full_name: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerRow = {
  id: string;
  profile_id: string;
  company_name: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CleanerRow = {
  id: string;
  profile_id: string;
  phone: string | null;
  active: boolean;
  suspended_at: string | null;
  deleted_at: string | null;
  onboarding_completed_at: string | null;
  suspension_ends_at: string | null;
  lifecycle_reason: string | null;
  average_rating: number | null;
  created_at: string;
  updated_at: string;
};

export type CleanerServiceAreaRow = {
  id: string;
  cleaner_id: string;
  area_slug: string;
  created_at: string;
};

export type CleanerServiceCapabilityRow = {
  id: string;
  cleaner_id: string;
  service_slug: string;
  created_at: string;
};

export type CleanerAvailabilityRow = {
  id: string;
  cleaner_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  created_at: string;
};

export type CleanerTimeOffRow = {
  id: string;
  cleaner_id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
  created_at: string;
};

export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  default_duration_minutes: number;
  base_price_cents: number;
  currency: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type BookingRow = {
  id: string;
  customer_id: string;
  cleaner_id: string | null;
  service_id: string | null;
  status: BookingStatus;
  scheduled_start: string;
  scheduled_end: string;
  assignment_dispatch_at: string | null;
  price_cents: number;
  currency: string;
  series_id: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type BookingSeriesRow = {
  id: string;
  customer_id: string;
  user_id: string | null;
  created_from_booking_id: string;
  frequency: "weekly" | "biweekly" | "monthly";
  timezone: string;
  anchor_scheduled_start: string;
  next_occurrence_at: string | null;
  status: "active" | "paused" | "cancelled";
  template_metadata: Json;
  service_slug: string;
  price_cents: number;
  created_at: string;
  updated_at: string;
};

export type PaymentRow = {
  id: string;
  booking_id: string;
  status: PaymentStatus;
  provider: string;
  provider_ref: string | null;
  idempotency_key: string;
  amount_cents: number;
  currency: string;
  payment_link_expires_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type BookingLockRow = {
  id: string;
  booking_id: string;
  customer_id: string;
  idempotency_key: string;
  status: BookingLockStatus;
  locked_at: string;
  expires_at: string;
  locked_price_cents: number;
  locked_currency: string;
  locked_service_slug: string;
  locked_schedule_start: string;
  locked_schedule_end: string;
  locked_schedule_timezone: string;
  locked_area_slug: string;
  locked_cleaner_preference: Json;
  locked_metadata: Json;
  client_quote_total_cents: number | null;
  inputs_hash: string;
  lock_version: number;
  created_at: string;
  updated_at: string;
};

export type PaymentEventRow = {
  id: string;
  payment_id: string | null;
  provider_event_id: string;
  event_type: string | null;
  payload: Json;
  received_at: string;
};

export type AssignmentOfferRow = {
  id: string;
  booking_id: string;
  cleaner_id: string;
  status: AssignmentOfferStatus;
  team_role: BookingCleanerRole;
  roster_id: string | null;
  offered_at: string;
  responded_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BookingCleanerRow = {
  id: string;
  booking_id: string;
  cleaner_id: string;
  role: BookingCleanerRole;
  status: BookingCleanerStatus;
  assigned_by_profile_id: string | null;
  /** NF-7F: set when support cleaner confirms participation (roster-only). */
  support_completed_at: string | null;
  /** NF-7F: optional note from support cleaner. */
  support_note: string | null;
  created_at: string;
  updated_at: string;
};

export const EARNING_PAYOUT_STATUSES = ["pending", "payout_ready", "paid"] as const;
export type EarningPayoutStatus = (typeof EARNING_PAYOUT_STATUSES)[number];

export type EarningLineRow = {
  id: string;
  cleaner_id: string;
  booking_id: string | null;
  amount_cents: number;
  gross_amount_cents: number;
  payout_amount_cents: number;
  payout_status: EarningPayoutStatus;
  payout_batch_id: string | null;
  line_type: string;
  description: string | null;
  metadata: Json;
  calculation_metadata: Json;
  /** NF-7G: primary | support */
  team_earning_role: string | null;
  /** NF-7G: team_split | manual_adjustment | legacy_primary */
  team_earning_source: string | null;
  created_at: string;
};

export type PayoutBatchRow = {
  id: string;
  label: string | null;
  status: string;
  total_payout_cents: number;
  currency: string;
  metadata: Json;
  created_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
  settled_at: string | null;
};

export type NotificationOutboxRow = {
  id: string;
  channel: string;
  recipient: string;
  payload: Json;
  status: NotificationOutboxStatus;
  attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationWorkerRunTriggerSource = "cron" | "manual";

export type DeferredDispatchCronRunRow = {
  id: string;
  started_at: string;
  completed_at: string;
  ok: boolean;
  trigger_source: "cron" | "manual";
  candidate_count: number;
  attempted_count: number;
  dispatched_count: number;
  skipped_count: number;
  failed_count: number;
  failed: Json;
  created_at: string;
};

export type RecurringGenerationRunStatus = "success" | "partial" | "failed";

export type RecurringGenerationRunRow = {
  id: string;
  run_id: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  status: RecurringGenerationRunStatus;
  active_series_scanned: number;
  children_generated: number;
  duplicates_skipped: number;
  skipped_paused: number;
  skipped_cancelled: number;
  failures_count: number;
  error_summary: Json;
  created_at: string;
};

export type NotificationWorkerRunRow = {
  id: string;
  started_at: string | null;
  completed_at: string;
  ok: boolean;
  delivery_enabled: boolean;
  email_provider: string | null;
  trigger_source: NotificationWorkerRunTriggerSource;
  reclaimed: number;
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  dry_run: number;
  error_count: number;
  errors: Json;
  created_at: string;
};

export type AssignmentMetricsHourlyRow = {
  bucket_start: string;
  offers_created_count: number;
  offers_accepted_count: number;
  offers_declined_count: number;
  offers_expired_count: number;
  offers_cancelled_count: number;
  bookings_assigned_count: number;
  redispatch_booking_count: number;
  max_attempts_booking_count: number;
  admin_intervention_count: number;
  offers_created_selected_count: number;
  offers_created_best_available_count: number;
  offers_created_admin_manual_count: number;
  offers_created_unknown_count: number;
  offers_accepted_selected_count: number;
  offers_accepted_best_available_count: number;
  offers_accepted_admin_manual_count: number;
  offers_accepted_unknown_count: number;
  time_to_assigned_bucket_0_15m_count: number;
  time_to_assigned_bucket_15_60m_count: number;
  time_to_assigned_bucket_1_4h_count: number;
  time_to_assigned_bucket_4_12h_count: number;
  time_to_assigned_bucket_12_24h_count: number;
  time_to_assigned_bucket_24_48h_count: number;
  time_to_assigned_bucket_48h_plus_count: number;
  time_to_assigned_sample_count: number;
  cleaner_response_bucket_0_15m_count: number;
  cleaner_response_bucket_15_60m_count: number;
  cleaner_response_bucket_1_4h_count: number;
  cleaner_response_bucket_4_12h_count: number;
  cleaner_response_bucket_12_24h_count: number;
  cleaner_response_bucket_24_48h_count: number;
  cleaner_response_bucket_48h_plus_count: number;
  cleaner_response_sample_count: number;
  time_to_first_offer_bucket_0_15m_count: number;
  time_to_first_offer_bucket_15_60m_count: number;
  time_to_first_offer_bucket_1_4h_count: number;
  time_to_first_offer_bucket_4_12h_count: number;
  time_to_first_offer_bucket_12_24h_count: number;
  time_to_first_offer_bucket_24_48h_count: number;
  time_to_first_offer_bucket_48h_plus_count: number;
  time_to_first_offer_sample_count: number;
  created_at: string;
  updated_at: string;
};

export type NotificationMetricsHourlyRow = {
  bucket_start: string;
  run_count: number;
  ok_run_count: number;
  failed_run_count: number;
  delivery_enabled_run_count: number;
  resend_run_count: number;
  dry_run_provider_run_count: number;
  reclaimed_count: number;
  scanned_count: number;
  sent_count: number;
  skipped_count: number;
  failed_count: number;
  dry_run_count: number;
  live_sent_count: number;
  live_failed_count: number;
  created_at: string;
  updated_at: string;
};

export type BookingStateAuditRow = {
  id: number;
  booking_id: string;
  from_status: BookingStatus | null;
  to_status: BookingStatus;
  command: BookingCommandType | string;
  actor_profile_id: string | null;
  payload: Json;
  created_at: string;
  actor_type: string;
  reason: string | null;
  idempotency_key: string | null;
  metadata: Json;
};

export type AdminOperationalAction =
  | "assignment_recovery"
  | "manual_dispatch_offer"
  | "replace_open_offer"
  | "notification_requeue";

export type AdminOperationalOutcome = "success" | "idempotent" | "rejected" | "failed";

export type AdminOperationalAuditRow = {
  id: string;
  booking_id: string;
  admin_profile_id: string;
  action: AdminOperationalAction;
  outcome: AdminOperationalOutcome;
  reason: string | null;
  result_code: string | null;
  cleaner_id: string | null;
  offer_id: string | null;
  cancelled_offer_id: string | null;
  idempotency_key: string | null;
  booking_status_before: string | null;
  booking_status_after: string | null;
  metadata: Json;
  created_at: string;
};

export type CleanerOperationalAuditRow = {
  id: string;
  cleaner_id: string;
  admin_profile_id: string | null;
  action: string;
  outcome: string;
  reason: string | null;
  before_state: Json;
  after_state: Json;
  affected_counts: Json;
  metadata: Json;
  idempotency_key: string | null;
  created_at: string;
};

export type CustomerOperationalAuditRow = {
  id: string;
  customer_id: string;
  admin_profile_id: string | null;
  action: string;
  outcome: string;
  reason: string | null;
  metadata: Json;
  idempotency_key: string | null;
  created_at: string;
};

/** Supabase client expects Insert/Update/Relationships on each table definition. */
export type PublicTable<Row> = {
  Row: Row;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

/**
 * Minimal `Database` shape compatible with `@supabase/supabase-js` generic when wired later.
 */
export type Database = {
  public: {
    Tables: {
      profiles: PublicTable<ProfileRow>;
      customers: PublicTable<CustomerRow>;
      cleaners: PublicTable<CleanerRow>;
      cleaner_service_areas: PublicTable<CleanerServiceAreaRow>;
      cleaner_service_capabilities: PublicTable<CleanerServiceCapabilityRow>;
      cleaner_availability: PublicTable<CleanerAvailabilityRow>;
      cleaner_time_off: PublicTable<CleanerTimeOffRow>;
      services: PublicTable<ServiceRow>;
      bookings: PublicTable<BookingRow>;
      booking_series: PublicTable<BookingSeriesRow>;
      booking_locks: PublicTable<BookingLockRow>;
      payments: PublicTable<PaymentRow>;
      payment_events: PublicTable<PaymentEventRow>;
      assignment_offers: PublicTable<AssignmentOfferRow>;
      booking_cleaners: PublicTable<BookingCleanerRow>;
      earning_lines: PublicTable<EarningLineRow>;
      payout_batches: PublicTable<PayoutBatchRow>;
      notification_outbox: PublicTable<NotificationOutboxRow>;
      notification_worker_runs: PublicTable<NotificationWorkerRunRow>;
      deferred_dispatch_cron_runs: PublicTable<DeferredDispatchCronRunRow>;
      recurring_generation_runs: PublicTable<RecurringGenerationRunRow>;
      notification_metrics_hourly: PublicTable<NotificationMetricsHourlyRow>;
      assignment_metrics_hourly: PublicTable<AssignmentMetricsHourlyRow>;
      booking_state_audit: PublicTable<BookingStateAuditRow>;
      admin_operational_audit: PublicTable<AdminOperationalAuditRow>;
      cleaner_operational_audit: PublicTable<CleanerOperationalAuditRow>;
      customer_operational_audit: PublicTable<CustomerOperationalAuditRow>;
    };
    Views: Record<
      string,
      {
        Row: Record<string, unknown>;
        Relationships: [];
      }
    >;
    Enums: {
      user_role: UserRole;
      booking_status: BookingStatus;
      payment_status: PaymentStatus;
      assignment_offer_status: AssignmentOfferStatus;
      booking_cleaner_role: BookingCleanerRole;
      booking_cleaner_status: BookingCleanerStatus;
      notification_outbox_status: NotificationOutboxStatus;
      booking_lock_status: BookingLockStatus;
      earning_payout_status: EarningPayoutStatus;
    };
    Functions: {
      ensure_customer_provisioned: {
        Args: { profile_id: string };
        Returns: string | null;
      };
      booking_apply_transition: {
        Args: Record<string, unknown>;
        Returns: Json;
      };
      booking_finalize_payment_success: {
        Args: Record<string, unknown>;
        Returns: Json;
      };
      booking_record_payment_failure: {
        Args: Record<string, unknown>;
        Returns: Json;
      };
    };
  };
};
