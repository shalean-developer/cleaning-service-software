import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WIZARD_STEPS } from "../types";
import { WIZARD_STEP_LABELS } from "../constants";
import { WizardStepper } from "./WizardStepper";
import { stepIndex } from "../navigation";

describe("WizardStepper (7P-1F)", () => {
  it("uses a compact mobile progress strip and desktop chip row", () => {
    const html = renderToStaticMarkup(<WizardStepper current="details" />);

    expect(html).toContain("md:hidden");
    expect(html).toContain("Step 4 of 7");
    expect(html).toContain("Details");
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("hidden w-full min-w-0 gap-0.5 md:flex");
    expect(html).toContain("min-w-0 flex-1");

    for (const step of WIZARD_STEPS) {
      const label = WIZARD_STEP_LABELS[step].replace(/&/g, "&amp;");
      expect(html).toContain(label);
    }
  });

  it("shows step 1 of 7 on the service step", () => {
    const html = renderToStaticMarkup(<WizardStepper current="service" />);
    expect(html).toContain("Step 1 of 7");
    expect(html).toContain("Service");
    expect(stepIndex("service")).toBe(0);
  });

  it('shows "Schedule" for the datetime step in the stepper', () => {
    const html = renderToStaticMarkup(<WizardStepper current="datetime" />);
    expect(html).toContain("Step 2 of 7");
    expect(html).toContain("Schedule");
    expect(html).not.toContain("Date &amp; time");
  });

  it("preserves active and completed chip styles on desktop", () => {
    const html = renderToStaticMarkup(<WizardStepper current="cleaner" />);

    expect(html).toContain("bg-zinc-900 text-white");
    expect(html).toContain("bg-zinc-200 text-zinc-800");
    expect(html).toContain("bg-zinc-100 text-zinc-500");
  });
});
