import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FrequencyStepPanel } from "./FrequencyStepPanel";

describe("FrequencyStepPanel", () => {
  it("renders four frequency pills with visible short hints", () => {
    const html = renderToStaticMarkup(
      <FrequencyStepPanel serviceSlug="regular-cleaning" value="weekly" onChange={() => {}} />,
    );

    expect(html).toContain("Preferred cleaning schedule");
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("grid grid-cols-2");
    expect(html).toContain("sm:grid-cols-4");
    expect(html).toContain("Once-off");
    expect(html).toContain("One visit");
    expect(html).toContain("Weekly");
    expect(html).toContain("First-booking preference");
    expect(html).toContain("follow-ups arranged after");
    expect(html).toContain("Bi-weekly");
    expect(html).toContain("Monthly");
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("border-shalean-primary");
    expect(html).toContain("bg-shalean-soft-blue/50");
    expect(html).not.toContain("sr-only");
    expect(html).not.toContain("border-blue-500");
  });

  it("shows validation error when provided", () => {
    const html = renderToStaticMarkup(
      <FrequencyStepPanel
        serviceSlug="regular-cleaning"
        value="once"
        onChange={() => {}}
        error="Invalid frequency."
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Invalid frequency.");
  });
});
