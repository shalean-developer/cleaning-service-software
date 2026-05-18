import { describe, expect, it } from "vitest";
import { DEFERRED_DISPATCH_OVERDUE_GRACE_MINUTES } from "./constants";
import {
  isDeferredDispatchExemptFromRecovery,
  isDeferredDispatchFailureExempt,
  isDeferredDispatchInReadyGrace,
  resolveDeferredDispatchStatus,
} from "./deferredDispatchStatus";

describe("resolveDeferredDispatchStatus phases", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");

  it("classifies awaiting dispatch window", () => {
    const dispatchAt = "2026-06-10T12:00:00.000Z";
    const status = resolveDeferredDispatchStatus({
      bookingStatus: "confirmed",
      assignmentDispatchAt: dispatchAt,
      scheduledStart: "2026-06-20T12:00:00.000Z",
      now,
    });
    expect(status.phase).toBe("awaiting_dispatch_window");
    expect(status.operationalAttentionRequired).toBe(false);
    expect(status.hoursUntilDispatch).toBeGreaterThan(0);
    expect(status.customerMessage).toContain("confirmed");
  });

  it("classifies ready for dispatch after window opens", () => {
    const dispatchAt = "2026-06-01T11:55:00.000Z";
    const status = resolveDeferredDispatchStatus({
      bookingStatus: "confirmed",
      assignmentDispatchAt: dispatchAt,
      now,
    });
    expect(status.phase).toBe("ready_for_dispatch");
    expect(status.adminOperationalCopy).toContain("Cron should dispatch");
    expect(status.operationalAttentionRequired).toBe(false);
  });

  it("classifies dispatch overdue after grace", () => {
    const dispatchAt = new Date(
      now.getTime() - (DEFERRED_DISPATCH_OVERDUE_GRACE_MINUTES + 5) * 60_000,
    ).toISOString();
    const status = resolveDeferredDispatchStatus({
      bookingStatus: "confirmed",
      assignmentDispatchAt: dispatchAt,
      now,
    });
    expect(status.phase).toBe("dispatch_overdue");
    expect(status.operationalAttentionRequired).toBe(true);
    expect(status.hoursOverdue).toBeGreaterThan(0);
    expect(status.adminOperationalCopy).toContain("overdue");
  });

  it("returns not_applicable when an open offer exists", () => {
    const status = resolveDeferredDispatchStatus({
      bookingStatus: "confirmed",
      assignmentDispatchAt: "2026-06-10T12:00:00.000Z",
      hasOpenOffer: true,
      now,
    });
    expect(status.phase).toBe("not_applicable");
  });
});

describe("deferred recovery exclusion", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");

  it("excludes future deferred from recovery", () => {
    expect(
      isDeferredDispatchExemptFromRecovery({
        assignmentDispatchAt: "2026-06-10T12:00:00.000Z",
        now,
      }),
    ).toBe(true);
  });

  it("excludes ready grace from failure surfaces", () => {
    expect(
      isDeferredDispatchInReadyGrace({
        assignmentDispatchAt: "2026-06-01T11:55:00.000Z",
        now,
      }),
    ).toBe(true);
    expect(
      isDeferredDispatchFailureExempt({
        assignmentDispatchAt: "2026-06-01T11:55:00.000Z",
        now,
      }),
    ).toBe(true);
  });

  it("does not exempt overdue deferred from failure surfaces", () => {
    const dispatchAt = new Date(
      now.getTime() - (DEFERRED_DISPATCH_OVERDUE_GRACE_MINUTES + 5) * 60_000,
    ).toISOString();
    expect(isDeferredDispatchFailureExempt({ assignmentDispatchAt: dispatchAt, now })).toBe(
      false,
    );
  });
});
