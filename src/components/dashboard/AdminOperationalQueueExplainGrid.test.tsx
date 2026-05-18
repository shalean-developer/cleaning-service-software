import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ADMIN_OPERATIONAL_QUEUES,
  buildAdminOperationalQueueCards,
} from "@/features/dashboards/adminOperationalQueues";
import { AdminOperationalQueueExplainGrid } from "./AdminOperationalQueueExplainGrid";

describe("AdminOperationalQueueExplainGrid (7A-2a)", () => {
  it("renders all five explainability cards when given full queue counts", () => {
    const cards = buildAdminOperationalQueueCards(
      ADMIN_OPERATIONAL_QUEUES.map((q, index) => ({
        key: q.key,
        label: q.label,
        count: index,
        href: `/admin/bookings?filter=${q.filter}`,
        tone: q.tone,
      })),
    );
    const html = renderToStaticMarkup(<AdminOperationalQueueExplainGrid cards={cards} />);
    expect(html).toContain("Queue guide");
    expect(html).toContain("Needs assignment");
    expect(html).toContain("Dispatch not started");
    expect(html).toContain("Recovery needed");
    expect(html).toContain("Payment attention");
    expect(html).toContain("Assignment attention");
    expect(html).toContain('aria-label="Operational queue explanations"');
  });

  it("omits section heading when embedded in the admin home queue guide", () => {
    const cards = buildAdminOperationalQueueCards(
      ADMIN_OPERATIONAL_QUEUES.map((q, index) => ({
        key: q.key,
        label: q.label,
        count: index,
        href: `/admin/bookings?filter=${q.filter}`,
        tone: q.tone,
      })),
    );
    const html = renderToStaticMarkup(<AdminOperationalQueueExplainGrid cards={cards} embedded />);

    expect(html).not.toContain("<h2");
    expect(html).not.toContain("What each queue means and what to do next");
    expect(html).toContain("Needs assignment");
    expect(html).toContain('aria-label="Operational queue explanations"');
  });
});
