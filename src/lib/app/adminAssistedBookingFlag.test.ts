import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminAssistedBookingEnabled } from "./adminAssistedBookingFlag";

describe("isAdminAssistedBookingEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false by default when env is unset", () => {
    vi.stubEnv("ADMIN_ASSISTED_BOOKING_ENABLED", undefined);
    expect(isAdminAssistedBookingEnabled()).toBe(false);
  });

  it("is false for explicit false values", () => {
    vi.stubEnv("ADMIN_ASSISTED_BOOKING_ENABLED", "false");
    expect(isAdminAssistedBookingEnabled()).toBe(false);
  });

  it("is true when enabled with true/1/yes", () => {
    vi.stubEnv("ADMIN_ASSISTED_BOOKING_ENABLED", "true");
    expect(isAdminAssistedBookingEnabled()).toBe(true);

    vi.stubEnv("ADMIN_ASSISTED_BOOKING_ENABLED", "1");
    expect(isAdminAssistedBookingEnabled()).toBe(true);

    vi.stubEnv("ADMIN_ASSISTED_BOOKING_ENABLED", "yes");
    expect(isAdminAssistedBookingEnabled()).toBe(true);
  });
});
