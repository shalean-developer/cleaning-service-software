import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TeamSupportStepPanel } from "./TeamSupportStepPanel";

describe("TeamSupportStepPanel", () => {
  it("renders label, visible hint, info control, and a switch", () => {
    const html = renderToStaticMarkup(<TeamSupportStepPanel value={1} onChange={() => {}} />);

    expect(html).toContain("Team support");
    expect(html).not.toContain("single-cleaner");
    expect(html).toContain("More information");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain('role="radio"');
    expect(html).not.toContain("Request 2 cleaners");
  });

  it("checks switch when two cleaners are requested", () => {
    const html = renderToStaticMarkup(<TeamSupportStepPanel value={2} onChange={() => {}} />);

    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("bg-shalean-primary");
    expect(html).toContain("Team support request");
    expect(html).toContain("+ R 200");
    expect(html).toContain("availability confirmed after payment");
  });
});
