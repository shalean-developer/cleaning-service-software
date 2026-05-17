import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildCleanerOffersPageUrl } from "@/lib/app/appBaseUrl";
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

  it("requires resend provider env when flag is on", () => {
    process.env.ENABLE_NOTIFICATION_DELIVERY = "true";
    process.env.NOTIFICATION_EMAIL_PROVIDER = "resend";
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

  it("resolves hosted app base URL for cleaner offer links on deployed runtimes", () => {
    process.env.VERCEL_ENV = "production";
    process.env.APP_BASE_URL = "https://cleaning-service-software.vercel.app";
    expect(getNotificationDeliveryConfig().appBaseUrl).toBe(
      "https://cleaning-service-software.vercel.app",
    );
    expect(buildCleanerOffersPageUrl(getNotificationDeliveryConfig().appBaseUrl)).toBe(
      "https://cleaning-service-software.vercel.app/cleaner/offers",
    );
  });

  it("does not use localhost app base URL on production-like env when VERCEL_URL is set", () => {
    process.env.VERCEL_ENV = "production";
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.VERCEL_URL = "cleaning-service-software.vercel.app";
    const { appBaseUrl } = getNotificationDeliveryConfig();
    expect(appBaseUrl).toBe("https://cleaning-service-software.vercel.app");
    expect(appBaseUrl).not.toContain("localhost");
  });

  it("defaults to dry_run when Resend is not configured", () => {
    process.env.ENABLE_NOTIFICATION_DELIVERY = "true";
    delete process.env.RESEND_API_KEY;
    delete process.env.NOTIFICATION_FROM_EMAIL;
    delete process.env.NOTIFICATION_EMAIL_PROVIDER;
    expect(getNotificationDeliveryConfig().emailProvider).toBe("dry_run");
    expect(canRunNotificationDelivery()).toBe(true);
  });

  it("uses resend on production when configured and provider unset", () => {
    process.env.VERCEL_ENV = "production";
    process.env.ENABLE_NOTIFICATION_DELIVERY = "true";
    process.env.RESEND_API_KEY = "re_test";
    process.env.NOTIFICATION_FROM_EMAIL = "bookings@example.com";
    delete process.env.NOTIFICATION_EMAIL_PROVIDER;
    expect(getNotificationDeliveryConfig().emailProvider).toBe("resend");
  });

  it("no-ops when resend provider is selected but Resend env is missing", () => {
    process.env.ENABLE_NOTIFICATION_DELIVERY = "true";
    process.env.NOTIFICATION_EMAIL_PROVIDER = "resend";
    delete process.env.RESEND_API_KEY;
    expect(canRunNotificationDelivery()).toBe(false);
  });

  it("does not treat Postmark token alone as provider ready for resend mode", () => {
    process.env.ENABLE_NOTIFICATION_DELIVERY = "true";
    process.env.NOTIFICATION_EMAIL_PROVIDER = "resend";
    process.env.NOTIFICATION_FROM_EMAIL = "bookings@example.com";
    process.env.POSTMARK_SERVER_TOKEN = "pm_test";
    delete process.env.RESEND_API_KEY;
    expect(getNotificationDeliveryConfig().providerReady).toBe(false);
    expect(canRunNotificationDelivery()).toBe(false);
  });
});
