import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ScheduleStepPanel } from "./ScheduleStepPanel";

const noop = () => {};

const scheduleFrequencyProps = {
  frequency: "once" as const,
  onFrequencyChange: noop,
};

describe("ScheduleStepPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T10:00:00+02:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("renders schedule picker headings and slot UI", () => {
    vi.stubEnv("NEXT_PUBLIC_BOOKING_EXTENDED_WINDOW_ENABLED", "false");
    const html = renderToStaticMarkup(
      <ScheduleStepPanel
        date="2026-05-20"
        time="09:00"
        minDate="2026-05-18"
        {...scheduleFrequencyProps}
        onDateChange={() => {}}
        onTimeChange={() => {}}
      />,
    );

    expect(html).toContain("Schedule");
    expect(html).not.toContain("Schedule your clean");
    expect(html).not.toContain(
      "Choose the date and start time that works best for you.",
    );
    expect(html).not.toContain("Times in South Africa (SAST).");
    expect(html).toContain("grid-cols-2");
    expect(html).toContain("lg:grid-cols-5");
    expect(html).toContain("max-w-3xl");
    expect(html).not.toContain("lg:w-fit");
    expect(html).toContain("Date");
    expect(html).toContain("Arrival time");
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
    expect(html).toContain("Choose your preferred service date");
    expect(html).not.toContain("Book up to 90 days ahead");
  });

  it("shows 90-day helper copy and env mismatch warning when extended", () => {
    vi.stubEnv("NEXT_PUBLIC_BOOKING_EXTENDED_WINDOW_ENABLED", "true");
    const html = renderToStaticMarkup(
      <ScheduleStepPanel
        date="2026-05-20"
        time="09:00"
        minDate="2026-05-18"
        bookingBounds={{
          minDate: "2026-05-18",
          maxDate: "2026-08-16",
          maxAdvanceDays: 90,
          extendedWindowEnabled: true,
        }}
        envMismatchWarning="Flags mismatched."
        {...scheduleFrequencyProps}
        onDateChange={() => {}}
        onTimeChange={() => {}}
      />,
    );

    expect(html).toContain("Book up to 90 days ahead");
    expect(html).toContain("Flags mismatched.");
  });

  it("shows selected date when it is outside the visible week", () => {
    const html = renderToStaticMarkup(
      <ScheduleStepPanel
        date="2026-07-01"
        time="09:00"
        minDate="2026-05-18"
        bookingBounds={{
          minDate: "2026-05-18",
          maxDate: "2026-08-16",
          maxAdvanceDays: 90,
          extendedWindowEnabled: true,
        }}
        {...scheduleFrequencyProps}
        onDateChange={() => {}}
        onTimeChange={() => {}}
      />,
    );

    expect(html).toContain("Selected date:");
    expect(html).toContain("2026-07-01");
  });

  it("shows validation errors when provided", () => {
    const html = renderToStaticMarkup(
      <ScheduleStepPanel
        date=""
        time=""
        minDate="2026-05-18"
        dateError="Please choose a date."
        timeError="Please choose a start time."
        {...scheduleFrequencyProps}
        onDateChange={() => {}}
        onTimeChange={() => {}}
      />,
    );

    expect(html).toContain("Please choose a date.");
    expect(html).toContain("Please choose a start time.");
  });

  it("renders frequency below arrival time for regular cleaning", () => {
    const html = renderToStaticMarkup(
      <ScheduleStepPanel
        serviceSlug="regular-cleaning"
        date="2026-05-20"
        time="09:00"
        frequency="weekly"
        minDate="2026-05-18"
        onDateChange={() => {}}
        onTimeChange={() => {}}
        onFrequencyChange={() => {}}
      />,
    );

    expect(html).toContain("Preferred cleaning schedule");
    expect(html).toContain("Weekly");
    expect(html.indexOf("Arrival time")).toBeLessThan(
      html.indexOf("Preferred cleaning schedule"),
    );
    expect(html.indexOf("Preferred cleaning schedule")).toBeLessThan(
      html.indexOf("Once-off"),
    );
  });

  it("renders frequency below arrival time for airbnb cleaning", () => {
    const html = renderToStaticMarkup(
      <ScheduleStepPanel
        serviceSlug="airbnb-cleaning"
        date="2026-05-20"
        time="09:00"
        frequency="weekly"
        minDate="2026-05-18"
        onDateChange={() => {}}
        onTimeChange={() => {}}
        onFrequencyChange={() => {}}
      />,
    );

    expect(html).toContain("Preferred turnover schedule");
    expect(html.indexOf("Arrival time")).toBeLessThan(
      html.indexOf("Preferred turnover schedule"),
    );
  });

  it("hides frequency for deep cleaning", () => {
    const html = renderToStaticMarkup(
      <ScheduleStepPanel
        serviceSlug="deep-cleaning"
        date="2026-05-20"
        time="09:00"
        frequency="weekly"
        minDate="2026-05-18"
        onDateChange={() => {}}
        onTimeChange={() => {}}
        onFrequencyChange={() => {}}
      />,
    );

    expect(html).not.toContain("Preferred cleaning schedule");
  });

  it("hides frequency for move in/out cleaning", () => {
    const html = renderToStaticMarkup(
      <ScheduleStepPanel
        serviceSlug="moving-cleaning"
        date="2026-05-20"
        time="09:00"
        frequency="weekly"
        minDate="2026-05-18"
        onDateChange={() => {}}
        onTimeChange={() => {}}
        onFrequencyChange={() => {}}
      />,
    );

    expect(html).not.toContain("Preferred cleaning schedule");
  });

  it("hides frequency for carpet cleaning", () => {
    const html = renderToStaticMarkup(
      <ScheduleStepPanel
        serviceSlug="carpet-cleaning"
        date="2026-05-20"
        time="09:00"
        frequency="weekly"
        minDate="2026-05-18"
        onDateChange={() => {}}
        onTimeChange={() => {}}
        onFrequencyChange={() => {}}
      />,
    );

    expect(html).not.toContain("Visit timing");
    expect(html).not.toContain("Preferred cleaning schedule");
  });

  it("shows frequency for office cleaning", () => {
    const html = renderToStaticMarkup(
      <ScheduleStepPanel
        serviceSlug="office-cleaning"
        date="2026-05-20"
        time="09:00"
        frequency="weekly"
        minDate="2026-05-18"
        onDateChange={() => {}}
        onTimeChange={() => {}}
        onFrequencyChange={() => {}}
      />,
    );

    expect(html).toContain("Service cadence");
    expect(html.indexOf("Arrival time")).toBeLessThan(html.indexOf("Service cadence"));
  });

  it("shows frequency validation error when provided", () => {
    const html = renderToStaticMarkup(
      <ScheduleStepPanel
        serviceSlug="regular-cleaning"
        date="2026-05-20"
        time="09:00"
        frequency="once"
        minDate="2026-05-18"
        frequencyError="Invalid frequency."
        onDateChange={() => {}}
        onTimeChange={() => {}}
        onFrequencyChange={() => {}}
      />,
    );

    expect(html).toContain("Invalid frequency.");
  });
});
