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
  created_at: string;
  updated_at: string;
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
  price_cents: number;
  currency: string;
  series_id: string | null;
  metadata: Json;
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
  metadata: Json;
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
  offered_at: string;
  responded_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EarningLineRow = {
  id: string;
  cleaner_id: string;
  booking_id: string | null;
  amount_cents: number;
  line_type: string;
  description: string | null;
  metadata: Json;
  created_at: string;
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
      services: PublicTable<ServiceRow>;
      bookings: PublicTable<BookingRow>;
      payments: PublicTable<PaymentRow>;
      payment_events: PublicTable<PaymentEventRow>;
      assignment_offers: PublicTable<AssignmentOfferRow>;
      earning_lines: PublicTable<EarningLineRow>;
      notification_outbox: PublicTable<NotificationOutboxRow>;
      booking_state_audit: PublicTable<BookingStateAuditRow>;
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
      notification_outbox_status: NotificationOutboxStatus;
    };
    Functions: {
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
