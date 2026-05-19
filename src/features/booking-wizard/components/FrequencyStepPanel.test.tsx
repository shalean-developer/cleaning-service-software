import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FrequencyStepPanel } from "./FrequencyStepPanel";

describe("FrequencyStepPanel", () => {
  it("renders four compact frequency pills with sr-only descriptions", () => {
    const html = renderToStaticMarkup(
      <FrequencyStepPanel value="weekly" onChange={() => {}} />,
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("grid grid-cols-2");
    expect(html).toContain("sm:grid-cols-4");
    expect(html).toContain("Once-off");
    expect(html).toContain("Single scheduled visit");
    expect(html).toContain("Weekly");
    expect(html).toContain("Best value");
    expect(html).toContain("Bi-weekly");
    expect(html).toContain("Popular");
    expect(html).toContain("Monthly");
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("border-zinc-900");
    expect(html).toContain("bg-zinc-50");
    expect(html).not.toContain("border-blue-500");
  });

  it("shows validation error when provided", () => {
    const html = renderToStaticMarkup(
      <FrequencyStepPanel value="once" onChange={() => {}} error="Invalid frequency." />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Invalid frequency.");
  });
});
