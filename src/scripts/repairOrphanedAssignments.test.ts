import { describe, expect, it, vi } from "vitest";
import {
  E2E_CUSTOMER_PREFIX,
  findOrphanedE2eAssignmentBookings,
  isE2eCustomerCompanyName,
  isOrphanedPendingAssignmentCandidate,
  runRepairOrphanedAssignments,
} from "./repairOrphanedAssignments";

describe("isE2eCustomerCompanyName", () => {
  it("matches test_e2e_ customer companies only", () => {
    expect(isE2eCustomerCompanyName(`${E2E_CUSTOMER_PREFIX}customer`)).toBe(true);
    expect(isE2eCustomerCompanyName("Acme Corp")).toBe(false);
    expect(isE2eCustomerCompanyName(null)).toBe(false);
  });
});

describe("isOrphanedPendingAssignmentCandidate", () => {
  it("includes pending_assignment without offered rows", () => {
    expect(
      isOrphanedPendingAssignmentCandidate(
        { status: "pending_assignment" },
        [{ status: "accepted" }],
      ),
    ).toBe(true);
  });

  it("skips bookings with an active offered row", () => {
    expect(
      isOrphanedPendingAssignmentCandidate(
        { status: "pending_assignment" },
        [{ status: "offered" }],
      ),
    ).toBe(false);
  });

  it("skips non-pending_assignment statuses", () => {
    expect(
      isOrphanedPendingAssignmentCandidate({ status: "confirmed" }, []),
    ).toBe(false);
  });
});

describe("findOrphanedE2eAssignmentBookings", () => {
  it("only returns test_e2e_ customer bookings without open offers", async () => {
    const offerByBooking: Record<string, { id: string; status: string }[]> = {
      "booking-orphan": [],
      "booking-has-offer": [{ id: "o1", status: "offered" }],
    };

    const client = {
      from: vi.fn((table: string) => {
        if (table === "customers") {
          return chainResolve({
            data: [{ id: "cust-e2e", company_name: "test_e2e_customer" }],
            error: null,
          });
        }
        if (table === "bookings") {
          return chainResolve({
            data: [
              {
                id: "booking-orphan",
                status: "pending_assignment",
                customer_id: "cust-e2e",
                metadata: {},
              },
              {
                id: "booking-has-offer",
                status: "pending_assignment",
                customer_id: "cust-e2e",
                metadata: {},
              },
            ],
            error: null,
          });
        }
        if (table === "assignment_offers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((_col: string, bookingId: string) =>
                Promise.resolve({
                  data: offerByBooking[bookingId] ?? [],
                  error: null,
                }),
              ),
            })),
          };
        }
        return chainResolve({ data: [], error: null });
      }),
    };

    const rows = await findOrphanedE2eAssignmentBookings(client as never);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.bookingId).toBe("booking-orphan");
  });
});

describe("runRepairOrphanedAssignments", () => {
  it("dry-run does not call assignment engine", async () => {
    const repairBooking = vi.fn();
    const client = createMockClient({
      bookings: [
        {
          id: "b1",
          status: "pending_assignment",
          customer_id: "c1",
          metadata: {},
        },
      ],
      offers: {},
    });

    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await runRepairOrphanedAssignments({
      dryRun: true,
      client: client as never,
      repairBooking,
    });

    expect(code).toBe(0);
    expect(repairBooking).not.toHaveBeenCalled();
  });

  it("apply mode uses assignment engine path for each candidate", async () => {
    const repairBooking = vi.fn().mockResolvedValue({
      ok: true,
      bookingId: "b1",
      bookingStatus: "pending_assignment",
      outcome: "offered",
      offerId: "offer-1",
      cleanerId: "cleaner-1",
      idempotent: false,
    });

    const client = createMockClient({
      bookings: [
        {
          id: "b1",
          status: "pending_assignment",
          customer_id: "c1",
          metadata: { assignment: { status: "offered", attemptedAt: "2026-05-16T00:00:00.000Z" } },
        },
      ],
      offers: { b1: [] },
    });

    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await runRepairOrphanedAssignments({
      dryRun: false,
      client: client as never,
      repairBooking,
    });

    expect(code).toBe(0);
    expect(repairBooking).toHaveBeenCalledTimes(1);
    expect(repairBooking).toHaveBeenCalledWith(client, "b1");
  });
});

function chainResolve(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    like: vi.fn(() => Promise.resolve(result)),
    then: (onFulfilled: (v: typeof result) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
  };
  return builder;
}

function createMockClient(params: {
  bookings: Array<{
    id: string;
    status: string;
    customer_id: string;
    metadata: Record<string, unknown>;
  }>;
  offers: Record<string, { id: string; status: string }[]>;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "customers") {
        return chainResolve({
          data: [{ id: "c1", company_name: "test_e2e_customer" }],
          error: null,
        });
      }
      if (table === "bookings") {
        return chainResolve({ data: params.bookings, error: null });
      }
      if (table === "assignment_offers") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_col: string, bookingId: string) =>
              Promise.resolve({
                data: params.offers[bookingId] ?? [],
                error: null,
              }),
            ),
          })),
        };
      }
      return chainResolve({ data: [], error: null });
    }),
  };
}
