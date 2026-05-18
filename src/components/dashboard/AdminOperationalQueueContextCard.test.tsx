import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildAdminOperationalQueueContextCard,
  isAdminOperationalQueueFilter,
} from "@/features/dashboards/adminOperationalQueues";
import { AdminOperationalQueueContextCard } from "./AdminOperationalQueueContextCard";

const queueSnapshots = [
  {
    key: "payment_attention" as const,
    label: "Payment attention",
    count: 2,
    href: "/admin/bookings?filter=payment_failed",
    tone: "danger" as const,
  },
  {
    key: "needs_assignment" as const,
    label: "Needs assignment",
    count: 0,
    href: "/admin/bookings?filter=pending_assignment",
    tone: "warning" as const,
  },
];

describe("isAdminOperationalQueueFilter (7A-2b)", () => {
  it("matches the five operational queue filters only", () => {
    expect(isAdminOperationalQueueFilter("payment_failed")).toBe(true);
    expect(isAdminOperationalQueueFilter("assignment_attention")).toBe(true);
    expect(isAdminOperationalQueueFilter(undefined)).toBe(false);
    expect(isAdminOperationalQueueFilter("selected_declined")).toBe(false);
    expect(isAdminOperationalQueueFilter("max_attempts")).toBe(false);
  });
});

describe("buildAdminOperationalQueueContextCard (7A-2b)", () => {
  it("returns merged card for operational filters", () => {
    const card = buildAdminOperationalQueueContextCard("payment_failed", queueSnapshots);
    expect(card?.severity).toBe("urgent");
    expect(card?.summary).toContain("payment failed");
    expect(card?.recommendedAction).toContain("customer");
  });

  it("returns null for non-operational filters", () => {
    expect(buildAdminOperationalQueueContextCard("selected_declined", queueSnapshots)).toBeNull();
  });
});

describe("AdminOperationalQueueContextCard (7A-2b)", () => {
  it("renders title, count, severity, summary, and recommended action from config", () => {
    const card = buildAdminOperationalQueueContextCard("payment_failed", queueSnapshots)!;
    const html = renderToStaticMarkup(<AdminOperationalQueueContextCard card={card} />);
    expect(html).toContain("Payment attention");
    expect(html).toContain("Urgent");
    expect(html).toContain("payment failed");
    expect(html).toContain("What to do:");
    expect(html).toContain("customer");
    expect(html).toContain(">2<");
    expect(html).toContain("bookings");
  });

  it("shows zero-count calm copy", () => {
    const card = buildAdminOperationalQueueContextCard("pending_assignment", queueSnapshots)!;
    const html = renderToStaticMarkup(<AdminOperationalQueueContextCard card={card} />);
    expect(html).toContain("No current bookings in this queue.");
  });

  it("includes runbook reference without mutation controls", () => {
    const card = buildAdminOperationalQueueContextCard("payment_failed", queueSnapshots)!;
    const html = renderToStaticMarkup(<AdminOperationalQueueContextCard card={card} />);
    expect(html).toContain("docs/operations/payment-failed-customer-retry.md");
    expect(html).not.toContain('type="submit"');
    expect(html).not.toContain("Recover assignment");
    expect(html).not.toContain("View all");
  });

  it("notes exact count vs list cap", () => {
    const card = buildAdminOperationalQueueContextCard("payment_failed", queueSnapshots)!;
    const html = renderToStaticMarkup(<AdminOperationalQueueContextCard card={card} />);
    expect(html).toContain("Exact count across all bookings");
    expect(html).toContain("up to 200");
  });
});
