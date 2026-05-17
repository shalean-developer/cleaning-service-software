import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canRunNotificationDelivery,
  getNotificationDeliveryConfig,
  getProcessingStaleMinutes,
  isNotificationDeliveryEnabled,
  NOTIFICATION_PROCESSING_STALE_MINUTES,
} from "./config";

describe("notification delivery config", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("is disabled by default", () => {
    delete process.env.ENABLE_NOTIFICATION_DELIVERY;
    expect(isNotificationDeliveryEnabled()).toBe(false);
    expect(canRunNotificationDelivery()).toBe(false);
  });

  it("requires provider env when flag is on", () => {
    process.env.ENABLE_NOTIFICATION_DELIVERY = "true";
    process.env.NOTIFICATION_FROM_EMAIL = "bookings@example.com";
    delete process.env.RESEND_API_KEY;
    delete process.env.POSTMARK_SERVER_TOKEN;
    expect(canRunNotificationDelivery()).toBe(false);
  });

  it("defaults processing stale minutes to 15", () => {
    delete process.env.NOTIFICATION_PROCESSING_STALE_MINUTES;
    expect(getProcessingStaleMinutes()).toBe(NOTIFICATION_PROCESSING_STALE_MINUTES);
  });

  it("parses NOTIFICATION_PROCESSING_STALE_MINUTES from env", () => {
    process.env.NOTIFICATION_PROCESSING_STALE_MINUTES = "30";
    expect(getProcessingStaleMinutes()).toBe(30);
  });

  it("is ready when flag, from email, and Resend key are set", () => {
    process.env.ENABLE_NOTIFICATION_DELIVERY = "true";
    process.env.NOTIFICATION_FROM_EMAIL = "bookings@example.com";
    process.env.RESEND_API_KEY = "re_test";
    expect(canRunNotificationDelivery()).toBe(true);
    expect(getNotificationDeliveryConfig().providerReady).toBe(true);
  });
});
