import type { BookingLockRow, Json } from "@/lib/database/types";
import type { BookingLockInput } from "./types";
import { hashLockInputs } from "./hashLockInputs";
import { BOOKING_LOCK_TTL_MINUTES } from "./constants";

/** Test-only in-memory lock store (no Supabase). */
export class InMemoryLockStore {
  locks = new Map<string, BookingLockRow>();

  async findByIdempotencyKey(key: string): Promise<BookingLockRow | null> {
    for (const lock of this.locks.values()) {
      if (lock.idempotency_key === key) return lock;
    }
    return null;
  }

  async findById(id: string): Promise<BookingLockRow | null> {
    return this.locks.get(id) ?? null;
  }

  async findActiveByBookingId(bookingId: string): Promise<BookingLockRow | null> {
    let latest: BookingLockRow | null = null;
    for (const lock of this.locks.values()) {
      if (lock.booking_id !== bookingId || lock.status !== "active") continue;
      if (!latest || lock.locked_at > latest.locked_at) latest = lock;
    }
    return latest;
  }

  async insert(params: {
    bookingId: string;
    customerId: string;
    input: BookingLockInput;
    lockedPriceCents: number;
    currency: string;
    lockedMetadata: Record<string, unknown>;
  }): Promise<BookingLockRow> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + BOOKING_LOCK_TTL_MINUTES * 60_000);
    const id = crypto.randomUUID();
    const row: BookingLockRow = {
      id,
      booking_id: params.bookingId,
      customer_id: params.customerId,
      idempotency_key: params.input.checkoutIdempotencyKey,
      status: "active",
      locked_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      locked_price_cents: params.lockedPriceCents,
      locked_currency: params.currency,
      locked_service_slug: params.input.pricingInput.serviceSlug,
      locked_schedule_start: params.input.scheduledStart,
      locked_schedule_end: params.input.scheduledEnd,
      locked_schedule_timezone: params.input.scheduleTimezone ?? "Africa/Johannesburg",
      locked_area_slug: params.input.areaSlug,
      locked_cleaner_preference: params.input.cleanerPreference,
      locked_metadata: params.lockedMetadata as Json,
      client_quote_total_cents: params.input.clientQuoteTotalCents,
      inputs_hash: hashLockInputs(params.input),
      lock_version: 1,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    this.locks.set(id, row);
    return row;
  }

  async markConsumed(lockId: string): Promise<void> {
    const lock = this.locks.get(lockId);
    if (lock) {
      this.locks.set(lockId, {
        ...lock,
        status: "consumed",
        updated_at: new Date().toISOString(),
      });
    }
  }

  async markExpired(lockId: string): Promise<void> {
    const lock = this.locks.get(lockId);
    if (lock) {
      this.locks.set(lockId, {
        ...lock,
        status: "expired",
        updated_at: new Date().toISOString(),
      });
    }
  }
}
