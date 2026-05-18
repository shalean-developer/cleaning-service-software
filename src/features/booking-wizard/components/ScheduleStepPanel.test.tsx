import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ScheduleStepPanel } from "./ScheduleStepPanel";

describe("ScheduleStepPanel", () => {
  it("renders schedule picker headings and slot UI", () => {
    const html = renderToStaticMarkup(
      <ScheduleStepPanel
        date="2026-05-20"
        time="09:00"
        minDate="2026-05-18"
        onDateChange={() => {}}
        onTimeChange={() => {}}
      />,
    );

    expect(html).toContain("Schedule your clean");
    expect(html).toContain(
      "Choose the date and start time that works best for you.",
    );
    expect(html).toContain("Times shown in South Africa time.");
    expect(html).toContain("Which day would you like us to come?");
    expect(html).toContain("What time would you like us to arrive?");
    expect(html).not.toMatch(/>\s*Today\s*</i);
    expect(html).not.toMatch(/>\s*Tomorrow\s*</i);
    expect(html).toContain("max-md:w-[4.25rem]");
    expect(html).toContain("data-date-value");
    expect((html.match(/md:snap-start/g) ?? []).length).toBe(7);
    expect(html).toMatch(/Scroll dates backward|Previous available date/);
    expect(html).toMatch(/Scroll dates forward|Next available date/);
    expect(html).toContain("h-11 w-11");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("justify-center");
    expect(html).toContain('type="date"');
    expect(html).toContain('type="time"');
    expect(html).not.toContain("Date &amp; time");
    expect(html).not.toContain("Africa/Johannesburg (SAST");
  });

  it("shows validation errors when provided", () => {
    const html = renderToStaticMarkup(
      <ScheduleStepPanel
        date=""
        time=""
        minDate="2026-05-18"
        dateError="Please choose a date."
        timeError="Please choose a start time."
        onDateChange={() => {}}
        onTimeChange={() => {}}
      />,
    );

    expect(html).toContain("Please choose a date.");
    expect(html).toContain("Please choose a start time.");
  });
});
