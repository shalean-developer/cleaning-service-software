import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ADMIN_OPERATIONAL_QUEUES,
  buildAdminOperationalQueueCards,
} from "@/features/dashboards/adminOperationalQueues";
import { AdminOperationalQueueGuideDetails } from "./AdminOperationalQueueGuideDetails";

const sampleCards = buildAdminOperationalQueueCards(
  ADMIN_OPERATIONAL_QUEUES.map((q, index) => ({
    key: q.key,
    label: q.label,
    count: index,
    href: `/admin/bookings?filter=${q.filter}`,
    tone: q.tone,
  })),
);

describe("AdminOperationalQueueGuideDetails (7P-1B)", () => {
  it("wraps explainability cards in a collapsed-by-default details element", () => {
    const html = renderToStaticMarkup(<AdminOperationalQueueGuideDetails cards={sampleCards} />);

    expect(html).toMatch(/<details(?![^>]*\bopen\b)[^>]*>/);
    expect(html).toContain("How to use this dashboard");
    expect(html).toContain('aria-label="Operational queue explanations"');
    expect(html).toContain("Needs assignment");
    expect(html).toContain("Dispatch not started");
    expect(html).toContain("Recovery needed");
    expect(html).toContain("Payment attention");
    expect(html).toContain("Assignment attention");
    expect(html).not.toContain("<h2");
  });

  it("exposes keyboard focus styles on the summary control", () => {
    const html = renderToStaticMarkup(<AdminOperationalQueueGuideDetails cards={sampleCards} />);

    expect(html).toContain("focus-visible:ring-2");
    expect(html).toContain("focus-visible:ring-zinc-900");
  });
});
