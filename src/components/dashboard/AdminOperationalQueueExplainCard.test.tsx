import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildAdminOperationalQueueCards } from "@/features/dashboards/adminOperationalQueues";
import { AdminOperationalQueueExplainCard } from "./AdminOperationalQueueExplainCard";

const sampleCard = buildAdminOperationalQueueCards([
  {
    key: "needs_assignment",
    label: "Needs assignment",
    count: 4,
    href: "/admin/bookings?filter=pending_assignment",
    tone: "warning",
  },
])[0]!;

const zeroCard = buildAdminOperationalQueueCards([
  {
    key: "payment_attention",
    label: "Payment attention",
    count: 0,
    href: "/admin/bookings?filter=payment_failed",
    tone: "danger",
  },
])[0]!;

describe("AdminOperationalQueueExplainCard (7A-2a)", () => {
  it("renders title, count, severity, why-here, and recommended action", () => {
    const html = renderToStaticMarkup(<AdminOperationalQueueExplainCard card={sampleCard} />);
    expect(html).toContain("Needs assignment");
    expect(html).toContain("Action needed");
    expect(html).toContain(">4<");
    expect(html).toContain("Why bookings appear here");
    expect(html).toContain("pending_assignment");
    expect(html).toContain("What to do");
    expect(html).toContain("Send offer to cleaner");
  });

  it("View all link points to the correct filter href", () => {
    const html = renderToStaticMarkup(<AdminOperationalQueueExplainCard card={sampleCard} />);
    expect(html).toContain('href="/admin/bookings?filter=pending_assignment"');
    expect(html).toContain("View all (4)");
  });

  it("shows calm zero-count copy and View list label", () => {
    const html = renderToStaticMarkup(<AdminOperationalQueueExplainCard card={zeroCard} />);
    expect(html).toContain("No current bookings in this queue.");
    expect(html).toContain("View list");
    expect(html).not.toContain("View all (0)");
  });

  it("includes runbook reference without mutation controls", () => {
    const html = renderToStaticMarkup(<AdminOperationalQueueExplainCard card={sampleCard} />);
    expect(html).toContain("Runbook:");
    expect(html).toContain("docs/operations/admin-operational-dashboard.md");
    expect(html).not.toContain('type="submit"');
    expect(html).not.toContain("Recover assignment");
  });
});
