import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TeamSupportStepPanel } from "./TeamSupportStepPanel";

describe("TeamSupportStepPanel", () => {
  it("renders a compact toggle row with pricing detail in the info tooltip", () => {
    const html = renderToStaticMarkup(<TeamSupportStepPanel value={1} onChange={() => {}} />);

    expect(html).toContain("Request 2 cleaners");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain("Adds R200");
    expect(html).not.toContain("Standard visit");
    expect(html).not.toContain("Team support");
    expect(html).not.toContain('role="radio"');
    expect(html).not.toContain(">1 cleaner<");
  });

  it("shows the toggle on when two cleaners are requested", () => {
    const html = renderToStaticMarkup(<TeamSupportStepPanel value={2} onChange={() => {}} />);

    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("bg-zinc-900");
  });
});
