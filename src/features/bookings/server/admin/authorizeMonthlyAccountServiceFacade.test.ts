import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth/types";
import type { Database, Json } from "@/lib/database/types";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { authorizeMonthlyAccountServiceFacade } from "./authorizeMonthlyAccountServiceFacade";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { readFileSync } from "node:fs";
import path from "node:path";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const hoisted = vi.hoisted(() => ({
  memoryBackend: null as InMemoryBookingCommandBackend | null,
  serviceAuthRows: [] as Record<string, unknown>[],
  billingAccount: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    customer_id: "11111111-1111-4111-8111-111111111111",
    billing_mode: "monthly_account",
    is_monthly_account_enabled: true,
    disabled_at: null,
    zoho_customer_id: "zoho-1",
    billing_email: "billing@example.com",
    billing_terms: "Net 30",
    approved_at: "2026-01-01T00:00:00.000Z",
    approved_by_admin_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  },
}));

vi.mock("@/lib/app/zohoMonthlyServiceAuthorizationFlag", () => ({
  isZohoMonthlyServiceAuthorizationEnabled: () => true,
}));

vi.mock("@/lib/app/zohoMonthlyAccountBillingFlag", () => ({
  isZohoMonthlyAccountBillingEnabled: () => true,
}));

vi.mock("@/lib/app/adminAssistedBookingFlag", () => ({
  isAdminAssistedBookingEnabled: () => true,
}));

vi.mock("@/features/bookings/server/commands/runBookingCommand", () => ({
  createBookingCommandBackend: () => {
    if (!hoisted.memoryBackend) throw new Error("memoryBackend not initialized");
    return hoisted.memoryBackend;
  },
}));

vi.mock("@/features/bookings/server/admin/postServiceAuthorizationDispatch", () => ({
  runPostServiceAuthorizationAssignmentDispatch: vi.fn(async () => undefined),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: () => createMockClient(),
}));

function createMockClient(): SupabaseClient<Database> {
  return {
    from: (table: string) => {
      if (table === "monthly_service_authorizations") {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: async () => {
                const row = hoisted.serviceAuthRows.find(
                  (r) => r.idempotency_key === val || r.booking_id === val,
                );
                return { data: row ?? null, error: null };
              },
            }),
          }),
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const inserted = {
                  id: `auth-${hoisted.serviceAuthRows.length + 1}`,
                  created_at: new Date().toISOString(),
                  status: "authorized",
                  ...row,
                };
                hoisted.serviceAuthRows.push(inserted);
                return { data: inserted, error: null };
              },
            }),
          }),
        };
      }
      if (table === "customer_billing_accounts") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: hoisted.billingAccount, error: null }),
            }),
          }),
        };
      }
      if (table === "customer_billing_account_audit") {
        return { insert: async () => ({ error: null }) };
      }
      if (table === "admin_booking_assist_audit") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: "audit-1" }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient<Database>;
}

const adminUser: CurrentUser = {
  profileId: ADMIN_ID,
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

const draftBody = {
  scheduledStart: "2099-06-15T07:00:00.000Z",
  scheduledEnd: "2099-06-15T09:00:00.000Z",
};

async function createMonthlyDraft(): Promise<string> {
  const bookingId = crypto.randomUUID();
  await hoisted.memoryBackend!.insertBooking({
    id: bookingId,
    customer_id: CUSTOMER_ID,
    status: "draft",
    price_cents: 50000,
    currency: "ZAR",
    scheduled_start: draftBody.scheduledStart,
    scheduled_end: draftBody.scheduledEnd,
    metadata: {
      billing: {
        mode: "monthly_account",
        monthlyAccountId: ACCOUNT_ID,
        zohoCustomerId: "zoho-1",
        billingEmail: "billing@example.com",
        billingTerms: "Net 30",
      },
    } as Json,
    cleaner_id: null,
    service_id: null,
    series_id: null,
    assignment_dispatch_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    archived_at: null,
  });
  return bookingId;
}

describe("authorizeMonthlyAccountServiceFacade", () => {
  beforeEach(() => {
    hoisted.memoryBackend = new InMemoryBookingCommandBackend();
    hoisted.serviceAuthRows = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("authorizes monthly_account draft and moves booking to confirmed", async () => {
    const bookingId = await createMonthlyDraft();
    const result = await authorizeMonthlyAccountServiceFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: CUSTOMER_ID,
        monthlyAccountId: ACCOUNT_ID,
        reason: "Approved corporate account",
        idempotencyKey: "authorize-key-phase3b-001",
        confirmMonthlyAccount: true,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.booking.status).toBe("confirmed");
    expect(hoisted.serviceAuthRows).toHaveLength(1);
    const booking = await hoisted.memoryBackend!.getBooking(bookingId);
    expect(booking?.status).toBe("confirmed");
  });

  it("rejects non-monthly billing metadata", async () => {
    const bookingId = crypto.randomUUID();
    await hoisted.memoryBackend!.insertBooking({
      id: bookingId,
      customer_id: CUSTOMER_ID,
      status: "draft",
      price_cents: 50000,
      currency: "ZAR",
      scheduled_start: draftBody.scheduledStart,
      scheduled_end: draftBody.scheduledEnd,
      metadata: { billing: { mode: "paystack_link" } } as Json,
      cleaner_id: null,
      service_id: null,
      series_id: null,
      assignment_dispatch_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      archived_at: null,
    });

    const result = await authorizeMonthlyAccountServiceFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: CUSTOMER_ID,
        monthlyAccountId: ACCOUNT_ID,
        reason: "Test",
        idempotencyKey: "authorize-key-phase3b-002",
        confirmMonthlyAccount: true,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_PAYLOAD");
  });

  it("does not import finalizePaidBooking", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/bookings/server/admin/authorizeMonthlyAccountServiceFacade.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/finalizePaidBooking/);
    expect(source).not.toMatch(/runPostPaymentZohoSalesSync/);
  });
});

describe("hasFinancialClearanceForCompletion via command layer", () => {
  beforeEach(() => {
    hoisted.memoryBackend = new InMemoryBookingCommandBackend();
  });

  it("allows monthly authorized booking to enter pending_assignment without paid payment", async () => {
    const bookingId = crypto.randomUUID();
    await hoisted.memoryBackend!.insertBooking({
      id: bookingId,
      customer_id: CUSTOMER_ID,
      status: "confirmed",
      price_cents: 50000,
      currency: "ZAR",
      scheduled_start: draftBody.scheduledStart,
      scheduled_end: draftBody.scheduledEnd,
      metadata: { billing: { mode: "monthly_account" } } as Json,
      cleaner_id: null,
      service_id: null,
      series_id: null,
      assignment_dispatch_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      archived_at: null,
    });
    hoisted.memoryBackend!.monthlyServiceAuthorizedBookingIds.add(bookingId);

    const result = await executeBookingCommand(
      hoisted.memoryBackend!,
      {
        type: "MOVE_TO_PENDING_ASSIGNMENT",
        actor: { actorType: "service", profileId: null },
        bookingId,
      },
      {},
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe("pending_assignment");
  });

  it("blocks unpaid non-monthly booking from pending_assignment", async () => {
    const bookingId = crypto.randomUUID();
    await hoisted.memoryBackend!.insertBooking({
      id: bookingId,
      customer_id: CUSTOMER_ID,
      status: "confirmed",
      price_cents: 50000,
      currency: "ZAR",
      scheduled_start: draftBody.scheduledStart,
      scheduled_end: draftBody.scheduledEnd,
      metadata: {} as Json,
      cleaner_id: null,
      service_id: null,
      series_id: null,
      assignment_dispatch_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      archived_at: null,
    });

    const result = await executeBookingCommand(
      hoisted.memoryBackend!,
      {
        type: "MOVE_TO_PENDING_ASSIGNMENT",
        actor: { actorType: "service", profileId: null },
        bookingId,
      },
      {},
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("PAYMENT_NOT_PAID");
  });
});
