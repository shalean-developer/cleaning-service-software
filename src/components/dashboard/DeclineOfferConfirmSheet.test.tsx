import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DeclineOfferConfirmSheet } from "./DeclineOfferConfirmSheet";

describe("DeclineOfferConfirmSheet", () => {
  it("renders dialog with summary and accessibility attributes", () => {
    const html = renderToStaticMarkup(
      <DeclineOfferConfirmSheet
        open
        loading={false}
        error={null}
        onClose={() => {}}
        onConfirm={() => {}}
        serviceLabel="Standard clean"
        scheduleLabel="Sat 19 May, 14:00–16:00"
        earningsLabel="R 350.00"
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Decline this job offer?");
    expect(html).toContain("You won&#x27;t be assigned to this cleaning job.");
    expect(html).toContain("This job may be offered to another cleaner.");
    expect(html).toContain("Standard clean");
    expect(html).toContain("Sat 19 May, 14:00–16:00");
    expect(html).toContain("Your earnings:");
    expect(html).toContain("R 350.00");
    expect(html).toContain("Keep offer");
    expect(html).toContain("Decline offer");
    expect(html).toContain("items-end");
    expect(html).toContain("md:items-center");
    expect(html).toContain("rounded-t-2xl");
    expect(html).toContain("md:rounded-2xl");
  });

  it("announces decline errors with alert role", () => {
    const html = renderToStaticMarkup(
      <DeclineOfferConfirmSheet
        open
        loading={false}
        error="Offer already declined."
        onClose={() => {}}
        onConfirm={() => {}}
        serviceLabel="Standard clean"
        scheduleLabel="Sat"
        earningsLabel="R 1.00"
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Offer already declined.");
  });

  it("renders nothing when closed", () => {
    const html = renderToStaticMarkup(
      <DeclineOfferConfirmSheet
        open={false}
        loading={false}
        error={null}
        onClose={() => {}}
        onConfirm={() => {}}
        serviceLabel="Standard clean"
        scheduleLabel="Sat"
        earningsLabel="R 1.00"
      />,
    );

    expect(html).toBe("");
  });
});
