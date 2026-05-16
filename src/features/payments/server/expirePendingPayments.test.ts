import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PaymentRow } from "@/lib/database/types";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import {
  expireStalePendingPayments,
  isStalePendingPayment,
} from "./expirePendingPayments";

const systemActor = { actorType: "system" as const, profileId: null };
const customerId = "cust-expire-pending";

function createPaymentsCronClient(
  backend: InMemoryBookingCommandBackend,
): SupabaseClient<Database> {
  return {
    from(table: string) {
      if (table === "bookings") {
        return {
          select: vi.fn(function select() {
            return {
              in: vi.fn(async (_col: string, ids: string[]) => ({
                data: ids
                  .map((id) => backend.bookings.get(id))
                  .filter(Boolean)
                  .map((b) => ({ id: b!.id, status: b!.status })),
                error: null,
              })),
            };
          }),
        };
      }

      if (table !== "payments") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const state = {
        statuses: [] as string[],
        orFilter: "",
        limitN: 50,
      };

      const chain = {
        select: vi.fn(function select(this: typeof chain) {
          return this;
        }),
        in: vi.fn(function inFilter(this: typeof chain, _col: string, vals: string[]) {
          state.statuses = vals;
          return this;
        }),
        or: vi.fn(function or(this: typeof chain, filter: string) {
          state.orFilter = filter;
          return this;
        }),
        order: vi.fn(function order(this: typeof chain) {
          return this;
        }),
        limit: vi.fn(async function limit(this: typeof chain, n: number) {
          state.limitN = n;
          const linkCutoff = extractCutoff(state.orFilter, "payment_link_expires_at.lt.");
          const createdCutoff = extractCutoff(
            state.orFilter,
            "created_at.lt.",
          );

          const rows = [...backend.payments.values()]
            .filter((p) => state.statuses.includes(p.status))
            .filter((p) => {
              return (
                (p.payment_link_expires_at != null &&
                  linkCutoff != null &&
                  p.payment_link_expires_at < linkCutoff) ||
                (p.payment_link_expires_at == null &&
                  createdCutoff != null &&
                  p.created_at < createdCutoff)
              );
            })
            .map((p) => ({
              id: p.id,
              booking_id: p.booking_id,
              status: p.status,
              payment_link_expires_at: p.payment_link_expires_at,
              created_at: p.created_at,
            }));

          return { data: rows.slice(0, state.limitN), error: null };
        }),
      };

      return chain;
    },
  } as unknown as SupabaseClient<Database>;
}

function extractCutoff(orFilter: string, prefix: string): string | null {
  const idx = orFilter.indexOf(prefix);
  if (idx === -1) return null;
  const start = idx + prefix.length;
  const end = orFilter.indexOf(",", start);
  return end === -1 ? orFilter.slice(start) : orFilter.slice(start, end);
}

async function seedPendingBooking(
  backend: InMemoryBookingCommandBackend,
  overrides: Partial<PaymentRow> = {},
): Promise<{ bookingId: string; payment: PaymentRow }> {
  const draft = await executeBookingCommand(
    backend,
    {
      type: "CREATE_BOOKING_DRAFT",
      actor: systemActor,
      customerId,
      scheduledStart: new Date().toISOString(),
      scheduledEnd: new Date(Date.now() + 3_600_000).toISOString(),
      priceCents: 12_000,
    },
    {},
  );
  expect(draft.ok).toBe(true);
  if (!draft.ok) throw new Error("draft");

  const pending = await executeBookingCommand(
    backend,
    {
      type: "MARK_PAYMENT_PENDING",
      actor: systemActor,
      bookingId: draft.bookingId,
      paymentIdempotencyKey: `pay:${draft.bookingId}:${crypto.randomUUID()}`,
    },
    {},
  );
  expect(pending.ok).toBe(true);

  const payment = [...backend.payments.values()].find(
    (p) => p.booking_id === draft.bookingId,
  )!;
  const patched: PaymentRow = { ...payment, ...overrides };
  backend.payments.set(payment.id, patched);

  return { bookingId: draft.bookingId, payment: patched };
}

describe("isStalePendingPayment", () => {
  it("uses link expiry plus grace", () => {
    const now = new Date("2026-05-16T12:00:00.000Z");
    expect(
      isStalePendingPayment(
        { payment_link_expires_at: "2026-05-16T11:30:00.000Z", created_at: now.toISOString() },
        now,
        15,
      ),
    ).toBe(true);
    expect(
      isStalePendingPayment(
        { payment_link_expires_at: "2026-05-16T11:50:00.000Z", created_at: now.toISOString() },
        now,
        15,
      ),
    ).toBe(false);
  });

  it("falls back to created_at plus lock TTL and grace when link expiry is null", () => {
    const now = new Date("2026-05-16T12:00:00.000Z");
    expect(
      isStalePendingPayment(
        {
          payment_link_expires_at: null,
          created_at: "2026-05-16T11:14:00.000Z",
        },
        now,
        15,
      ),
    ).toBe(true);
    expect(
      isStalePendingPayment(
        {
          payment_link_expires_at: null,
          created_at: "2026-05-16T11:20:00.000Z",
        },
        now,
        15,
      ),
    ).toBe(false);
  });
});

describe("expireStalePendingPayments", () => {
  const now = new Date("2026-05-16T12:00:00.000Z");

  it("marks stale pending payment as payment_failed", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const { bookingId, payment } = await seedPendingBooking(backend, {
      payment_link_expires_at: "2026-05-16T11:00:00.000Z",
    });

    const result = await expireStalePendingPayments(
      createPaymentsCronClient(backend),
      backend,
      { now },
    );

    expect(result.scanned).toBe(1);
    expect(result.expired).toBe(1);
    expect(backend.bookings.get(bookingId)?.status).toBe("payment_failed");
    expect(backend.payments.get(payment.id)?.status).toBe("failed");
    const audit = backend.audits.find(
      (a) => a.idempotency_key === `cron:expire-pending-payment:${payment.id}`,
    );
    expect(audit?.metadata).toMatchObject({ failure_reason: "checkout_expired" });
  });

  it("skips paid payment", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const { payment } = await seedPendingBooking(backend, {
      payment_link_expires_at: "2026-05-16T11:00:00.000Z",
    });
    payment.status = "paid";
    backend.payments.set(payment.id, payment);

    const result = await expireStalePendingPayments(
      createPaymentsCronClient(backend),
      backend,
      { now },
    );

    expect(result.scanned).toBe(0);
    expect(result.expired).toBe(0);
  });

  it("skips not-yet-expired pending payment", async () => {
    const backend = new InMemoryBookingCommandBackend();
    await seedPendingBooking(backend, {
      payment_link_expires_at: "2026-05-16T11:50:00.000Z",
    });

    const result = await expireStalePendingPayments(
      createPaymentsCronClient(backend),
      backend,
      { now },
    );

    expect(result.scanned).toBe(0);
    expect(result.expired).toBe(0);
  });

  it("skips booking not in pending_payment", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const { bookingId, payment } = await seedPendingBooking(backend, {
      payment_link_expires_at: "2026-05-16T11:00:00.000Z",
    });
    const booking = backend.bookings.get(bookingId)!;
    booking.status = "confirmed";
    backend.bookings.set(bookingId, booking);

    const result = await expireStalePendingPayments(
      createPaymentsCronClient(backend),
      backend,
      { now },
    );

    expect(result.scanned).toBe(0);
    expect(result.expired).toBe(0);
    expect(backend.payments.get(payment.id)?.status).toBe("pending");
  });

  it("is idempotent on cron rerun", async () => {
    const backend = new InMemoryBookingCommandBackend();
    await seedPendingBooking(backend, {
      payment_link_expires_at: "2026-05-16T11:00:00.000Z",
    });
    const client = createPaymentsCronClient(backend);

    const first = await expireStalePendingPayments(client, backend, { now });
    expect(first.expired).toBe(1);

    const second = await expireStalePendingPayments(client, backend, { now });
    expect(second.scanned).toBe(0);
    expect(second.expired).toBe(0);
  });

  it("records command errors but continues processing other rows", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const a = await seedPendingBooking(backend, {
      payment_link_expires_at: "2026-05-16T10:00:00.000Z",
    });
    const b = await seedPendingBooking(backend, {
      payment_link_expires_at: "2026-05-16T10:30:00.000Z",
    });

    const original = backend.recordPaymentFailure.bind(backend);
    let calls = 0;
    backend.recordPaymentFailure = async (...args) => {
      calls += 1;
      if (calls === 1) throw new Error("simulated persistence failure");
      return original(...args);
    };

    const result = await expireStalePendingPayments(
      createPaymentsCronClient(backend),
      backend,
      { now },
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.paymentId).toBe(a.payment.id);
    expect(result.expired).toBe(1);
    expect(backend.bookings.get(b.bookingId)?.status).toBe("payment_failed");
  });
});
