import { describe, expect, it, vi } from "vitest";
import {
  resolveRollupBucketStart,
  rollupAssignmentMetricsHourly,
} from "./rollupAssignmentMetricsHourly";

describe("rollupAssignmentMetricsHourly (7B-1a)", () => {
  const now = new Date("2026-05-18T12:30:00.000Z");

  it("resolveRollupBucketStart defaults to previous closed hour", () => {
    const bucket = resolveRollupBucketStart(null, now);
    expect(bucket.toISOString()).toBe("2026-05-18T11:00:00.000Z");
  });

  it("upserts time-to-assigned histogram columns for a bucket", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const acceptAudit = {
      booking_id: "booking-1",
      created_at: "2026-05-18T11:30:00.000Z",
    };
    const pendingAudit = {
      booking_id: "booking-1",
      created_at: "2026-05-18T11:00:00.000Z",
    };

    const client = {
      from: vi.fn((table: string) => {
        if (table === "assignment_offers") {
          return {
            select: vi.fn(() => ({
              gte: vi.fn(() => ({
                lt: vi.fn(async () => ({ data: [], error: null })),
              })),
              in: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lt: vi.fn(async () => ({ data: [], error: null })),
                })),
              })),
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lt: vi.fn(async () => ({ data: [], error: null })),
                })),
              })),
            })),
          };
        }
        if (table === "booking_state_audit") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((field: string, value: string) => {
                if (field === "command" && value === "ACCEPT_CLEANER_ASSIGNMENT") {
                  return {
                    gte: vi.fn(() => ({
                      lt: vi.fn(async () => ({ data: [acceptAudit], error: null })),
                    })),
                  };
                }
                if (field === "command" && value === "MOVE_TO_PENDING_ASSIGNMENT") {
                  return {
                    in: vi.fn(async () => ({ data: [pendingAudit], error: null })),
                  };
                }
                throw new Error(`unexpected eq ${field} ${value}`);
              }),
            })),
          };
        }
        if (table === "admin_operational_audit") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                in: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    lt: vi.fn(async () => ({ count: 0, error: null })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === "assignment_metrics_hourly") {
          return { upsert };
        }
        if (table === "bookings") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({ data: [], error: null })),
            })),
          };
        }
        if (table === "booking_locks") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                eq: vi.fn(async () => ({ data: [], error: null })),
              })),
            })),
          };
        }
        throw new Error(`unexpected ${table}`);
      }),
    };

    await rollupAssignmentMetricsHourly(client as never, null, now);

    expect(upsert).toHaveBeenCalledOnce();
    const row = upsert.mock.calls[0]?.[0];
    expect(row.time_to_assigned_sample_count).toBe(1);
    expect(row.time_to_assigned_bucket_0_15m_count).toBe(0);
    expect(row.time_to_assigned_bucket_15_60m_count).toBe(1);
  });

  it("upserts cleaner response histogram for terminal offers in bucket", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const terminalOffer = {
      booking_id: "booking-1",
      status: "accepted",
      offered_at: "2026-05-18T11:00:00.000Z",
      responded_at: "2026-05-18T11:20:00.000Z",
      updated_at: "2026-05-18T11:20:00.000Z",
    };

    const client = {
      from: vi.fn((table: string) => {
        if (table === "assignment_offers") {
          return {
            select: vi.fn(() => ({
              gte: vi.fn(() => ({
                lt: vi.fn(async () => ({ data: [], error: null })),
              })),
              in: vi.fn((field: string) => {
                if (field === "status") {
                  return {
                    gte: vi.fn(() => ({
                      lt: vi.fn(async () => ({ data: [terminalOffer], error: null })),
                    })),
                  };
                }
                return {
                  lt: vi.fn(async () => ({ data: [], error: null })),
                };
              }),
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lt: vi.fn(async () => ({ data: [], error: null })),
                })),
              })),
            })),
          };
        }
        if (table === "booking_state_audit") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lt: vi.fn(async () => ({ data: [], error: null })),
                })),
                in: vi.fn(async () => ({ data: [], error: null })),
              })),
            })),
          };
        }
        if (table === "admin_operational_audit") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                in: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    lt: vi.fn(async () => ({ count: 0, error: null })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === "assignment_metrics_hourly") {
          return { upsert };
        }
        if (table === "bookings") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({ data: [], error: null })),
            })),
          };
        }
        if (table === "booking_locks") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                eq: vi.fn(async () => ({ data: [], error: null })),
              })),
            })),
          };
        }
        throw new Error(`unexpected ${table}`);
      }),
    };

    await rollupAssignmentMetricsHourly(client as never, null, now);

    const row = upsert.mock.calls[0]?.[0];
    expect(row.cleaner_response_sample_count).toBe(1);
    expect(row.cleaner_response_bucket_15_60m_count).toBe(1);
  });

  it("upserts aggregated counters for a bucket", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "assignment_offers") {
          return {
            select: vi.fn(() => ({
              gte: vi.fn(() => ({
                lt: vi.fn(async () => ({ data: [], error: null })),
              })),
              in: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lt: vi.fn(async () => ({ data: [], error: null })),
                })),
              })),
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lt: vi.fn(async () => ({ data: [], error: null })),
                })),
              })),
            })),
          };
        }
        if (table === "booking_state_audit") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lt: vi.fn(async () => ({ data: [], error: null })),
                })),
              })),
            })),
          };
        }
        if (table === "admin_operational_audit") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                in: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    lt: vi.fn(async () => ({ count: 0, error: null })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === "assignment_metrics_hourly") {
          return { upsert };
        }
        if (table === "bookings") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({ data: [], error: null })),
            })),
          };
        }
        if (table === "booking_locks") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                eq: vi.fn(async () => ({ data: [], error: null })),
              })),
            })),
          };
        }
        throw new Error(`unexpected ${table}`);
      }),
    };

    const result = await rollupAssignmentMetricsHourly(client as never, null, now);
    expect(result.bucketStart).toBe("2026-05-18T11:00:00.000Z");
    expect(result.upserted).toBe(true);
    expect(upsert).toHaveBeenCalledOnce();
  });
});
