import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isAdminAssistedOfflinePaymentsActive,
  isAdminAssistedOfflinePaymentsEnabled,
} from "./adminAssistedOfflinePaymentsFlag";

describe("adminAssistedOfflinePaymentsFlag", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false by default", () => {
    vi.stubEnv("ADMIN_ASSISTED_OFFLINE_PAYMENTS_ENABLED", undefined);
    expect(isAdminAssistedOfflinePaymentsEnabled()).toBe(false);
    expect(isAdminAssistedOfflinePaymentsActive()).toBe(false);
  });

  it("requires admin assisted booking flag too", () => {
    vi.stubEnv("ADMIN_ASSISTED_OFFLINE_PAYMENTS_ENABLED", "true");
    vi.stubEnv("ADMIN_ASSISTED_BOOKING_ENABLED", "false");
    expect(isAdminAssistedOfflinePaymentsActive()).toBe(false);

    vi.stubEnv("ADMIN_ASSISTED_BOOKING_ENABLED", "true");
    expect(isAdminAssistedOfflinePaymentsActive()).toBe(true);
  });
});
