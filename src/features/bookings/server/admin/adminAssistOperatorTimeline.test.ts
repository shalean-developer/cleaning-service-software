import { describe, expect, it } from "vitest";
import {
  formatAdminAssistRelativeTimestamp,
  groupAdminAssistTimelineEntries,
  resolveAdminAssistNextRecommendedAction,
} from "./adminAssistOperatorTimeline";
import type { AdminAssistTimelineEntry } from "./buildAdminBookingAssistTimeline";

const baseEntry = (patch: Partial<AdminAssistTimelineEntry>): AdminAssistTimelineEntry => ({
  id: "e1",
  at: "2026-05-23T10:00:00.000Z",
  kind: "draft_created",
  title: "Draft",
  description: null,
  reference: null,
  deliveryChannel: null,
  adminProfileId: "op1",
  previousReference: null,
  ...patch,
});

describe("adminAssistOperatorTimeline", () => {
  it("groups entries by lifecycle", () => {
    const groups = groupAdminAssistTimelineEntries([
      baseEntry({ id: "d1", kind: "draft_created" }),
      baseEntry({ id: "p1", kind: "payment_link_generated" }),
      baseEntry({ id: "n1", kind: "payment_request_sent" }),
      baseEntry({ id: "o1", kind: "offline_payment_recorded" }),
    ]);

    expect(groups.map((g) => g.id)).toEqual(["draft", "payment", "notification", "offline"]);
  });

  it("formats relative timestamps", () => {
    const nowMs = Date.parse("2026-05-23T10:05:00.000Z");
    expect(formatAdminAssistRelativeTimestamp("2026-05-23T10:04:00.000Z", nowMs)).toBe("1m ago");
  });

  it("recommends regenerate when link expired", () => {
    const action = resolveAdminAssistNextRecommendedAction({
      bookingStatus: "pending_payment",
      paymentLinkExpired: true,
      hasPaymentLink: true,
      customerHasEmail: true,
      emailFailed: false,
      bookingConfirmed: false,
    });
    expect(action?.label).toBe("Regenerate payment link");
  });

  it("recommends resend email when delivery failed", () => {
    const action = resolveAdminAssistNextRecommendedAction({
      bookingStatus: "pending_payment",
      paymentLinkExpired: false,
      hasPaymentLink: true,
      customerHasEmail: true,
      emailFailed: true,
      bookingConfirmed: false,
    });
    expect(action?.label).toBe("Resend payment request email");
  });
});
