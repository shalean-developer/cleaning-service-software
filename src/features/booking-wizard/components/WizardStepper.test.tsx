import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WIZARD_STEPS } from "../types";
import { WIZARD_STEP_LABELS } from "../constants";
import { WizardStepper } from "./WizardStepper";

describe("WizardStepper (7P-1F)", () => {
  it("uses tighter mobile spacing while keeping all step labels visible", () => {
    const html = renderToStaticMarkup(<WizardStepper current="details" />);

    expect(html).toContain("gap-0.5");
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("min-w-[4rem]");
    expect(html).toContain("py-1.5");
    expect(html).not.toContain("gap-1 ");
    expect(html).not.toContain("min-w-[4.5rem]");
    expect(html).not.toContain("py-2 ");

    expect(html.match(/block truncate/g)?.length).toBe(WIZARD_STEPS.length);
    for (const step of WIZARD_STEPS) {
      const label = WIZARD_STEP_LABELS[step].replace(/&/g, "&amp;");
      expect(html).toContain(label);
    }
  });

  it("preserves active and completed chip styles", () => {
    const html = renderToStaticMarkup(<WizardStepper current="cleaner" />);

    expect(html).toContain("bg-zinc-900 text-white");
    expect(html).toContain("bg-zinc-200 text-zinc-800");
    expect(html).toContain("bg-zinc-100 text-zinc-500");
  });
});
