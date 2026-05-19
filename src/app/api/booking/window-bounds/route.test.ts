import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /api/booking/window-bounds", () => {
  const now = new Date("2026-05-18T10:00:00+02:00");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("returns server booking window bounds", async () => {
    vi.stubEnv("BOOKING_EXTENDED_WINDOW_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_BOOKING_EXTENDED_WINDOW_ENABLED", "true");

    const response = await GET();
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.minDate).toBe("2026-05-18");
    expect(body.maxDate).toBe("2026-08-16");
    expect(body.maxAdvanceDays).toBe(90);
    expect(body.extendedWindowEnabled).toBe(true);
    expect(body.envMismatchWarning).toBeNull();
  });

  it("surfaces env mismatch warning when flags disagree", async () => {
    vi.stubEnv("BOOKING_EXTENDED_WINDOW_ENABLED", "false");
    vi.stubEnv("NEXT_PUBLIC_BOOKING_EXTENDED_WINDOW_ENABLED", "true");

    const response = await GET();
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.maxAdvanceDays).toBe(14);
    expect(body.envMismatchWarning).toMatch(/server limit is 14 days/i);
  });
});
