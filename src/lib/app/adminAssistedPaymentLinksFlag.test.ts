import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isAdminAssistedPaymentLinksActive,
  isAdminAssistedPaymentLinksEnabled,
} from "./adminAssistedPaymentLinksFlag";

describe("isAdminAssistedPaymentLinksEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false by default when env is unset", () => {
    vi.stubEnv("ADMIN_ASSISTED_PAYMENT_LINKS_ENABLED", undefined);
    expect(isAdminAssistedPaymentLinksEnabled()).toBe(false);
  });

  it("is false for explicit false values", () => {
    vi.stubEnv("ADMIN_ASSISTED_PAYMENT_LINKS_ENABLED", "false");
    expect(isAdminAssistedPaymentLinksEnabled()).toBe(false);
  });

  it("is true when enabled with true/1/yes", () => {
    vi.stubEnv("ADMIN_ASSISTED_PAYMENT_LINKS_ENABLED", "true");
    expect(isAdminAssistedPaymentLinksEnabled()).toBe(true);
  });
});

describe("isAdminAssistedPaymentLinksActive", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires both booking and payment-link flags", () => {
    vi.stubEnv("ADMIN_ASSISTED_BOOKING_ENABLED", "false");
    vi.stubEnv("ADMIN_ASSISTED_PAYMENT_LINKS_ENABLED", "true");
    expect(isAdminAssistedPaymentLinksActive()).toBe(false);

    vi.stubEnv("ADMIN_ASSISTED_BOOKING_ENABLED", "true");
    vi.stubEnv("ADMIN_ASSISTED_PAYMENT_LINKS_ENABLED", "false");
    expect(isAdminAssistedPaymentLinksActive()).toBe(false);

    vi.stubEnv("ADMIN_ASSISTED_BOOKING_ENABLED", "true");
    vi.stubEnv("ADMIN_ASSISTED_PAYMENT_LINKS_ENABLED", "true");
    expect(isAdminAssistedPaymentLinksActive()).toBe(true);
  });
});
