import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TeamSupportStepPanel } from "./TeamSupportStepPanel";

describe("TeamSupportStepPanel", () => {
  it("renders label, info control, and a switch", () => {
    const html = renderToStaticMarkup(<TeamSupportStepPanel value={1} onChange={() => {}} />);

    expect(html).toContain("Team support");
    expect(html).toContain("More information");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain('role="radio"');
    expect(html).not.toContain("Request 2 cleaners");
  });

  it("checks switch when two cleaners are requested", () => {
    const html = renderToStaticMarkup(<TeamSupportStepPanel value={2} onChange={() => {}} />);

    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("bg-zinc-900");
  });
});
