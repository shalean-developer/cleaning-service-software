import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WIZARD_SERVICE_OPTIONS } from "../constants";
import { ServiceStepPanel } from "./ServiceStepPanel";

describe("ServiceStepPanel", () => {
  it("uses mobile rows with subtitles and a 2-col / 3-col desktop grid", () => {
    const html = renderToStaticMarkup(
      <ServiceStepPanel
        options={WIZARD_SERVICE_OPTIONS}
        selectedSlug="regular-cleaning"
        onSelect={() => {}}
      />,
    );

    expect(html).toContain("flex flex-col gap-3");
    expect(html).toContain("md:grid md:grid-cols-2");
    expect(html).toContain("xl:grid-cols-3");
    expect(html).not.toContain("truncate");
    expect(html).toContain("[text-wrap:pretty] line-clamp-2");
    expect(html).toContain("md:hidden");
    expect(html).toContain("hidden w-full min-w-0 md:block");
    expect(html).toContain("min-h-[2.625rem]");
    expect(html).toContain("Most booked");
    expect(html).toContain("-translate-y-1/2");
    expect(html).toContain("whitespace-nowrap");
    expect(html).toContain("bg-sky-50");
    expect(html).not.toContain("bg-zinc-200/80");
    expect(html).toContain("Routine upkeep for your home");
    expect(html).toContain("Routine clean for kitchens, bathrooms, and living areas.");
    expect(html).toContain("Fast, detail-focused property preparation");
    expect(html).toContain("Intensive home restoration cleaning");
    expect(html).not.toContain("Tap a service, then continue below");
    expect(html).toContain("Regular Cleaning");
    const enabledCount = WIZARD_SERVICE_OPTIONS.filter((s) => s.enabled).length;
    expect(html.match(/aria-pressed="true"/g)?.length).toBe(2);
    expect(html).not.toContain("border-2 border-zinc-300");
    expect(html.match(/aria-pressed="false"/g)?.length).toBe((enabledCount - 1) * 2);
  });

  it("shows validation error when provided", () => {
    const html = renderToStaticMarkup(
      <ServiceStepPanel
        options={WIZARD_SERVICE_OPTIONS}
        selectedSlug={null}
        onSelect={() => {}}
        error="Please select a service."
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Please select a service.");
  });
});
