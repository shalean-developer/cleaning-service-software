import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminAssistedBookingDryRunLabelingEnabled } from "./adminAssistedBookingDryRunFlag";

describe("isAdminAssistedBookingDryRunLabelingEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is enabled when pilot mode is on even without explicit dry-run flag", () => {
    vi.stubEnv("ADMIN_ASSISTED_BOOKING_DRY_RUN_LABEL", undefined);
    vi.stubEnv("ADMIN_ASSISTED_BOOKING_PILOT_MODE", "true");
    expect(isAdminAssistedBookingDryRunLabelingEnabled()).toBe(true);
  });

  it("explicit dry-run false overrides pilot mode", () => {
    vi.stubEnv("ADMIN_ASSISTED_BOOKING_PILOT_MODE", "true");
    vi.stubEnv("ADMIN_ASSISTED_BOOKING_DRY_RUN_LABEL", "false");
    expect(isAdminAssistedBookingDryRunLabelingEnabled()).toBe(false);
  });
});
