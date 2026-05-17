import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildCleanerOffersPageUrl,
  isDeployedRuntime,
  isLocalhostAppBaseUrl,
  resolveNotificationAppBaseUrl,
} from "./appBaseUrl";

describe("appBaseUrl", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("detects localhost origins", () => {
    expect(isLocalhostAppBaseUrl("http://localhost:3000")).toBe(true);
    expect(isLocalhostAppBaseUrl("http://127.0.0.1:3000")).toBe(true);
    expect(isLocalhostAppBaseUrl("https://cleaning-service-software.vercel.app")).toBe(false);
  });

  it("builds hosted cleaner offers link from app base URL", () => {
    expect(
      buildCleanerOffersPageUrl("https://cleaning-service-software.vercel.app"),
    ).toBe("https://cleaning-service-software.vercel.app/cleaner/offers");
  });

  it("uses localhost in local development", () => {
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.APP_BASE_URL = "http://localhost:3000";
    expect(resolveNotificationAppBaseUrl()).toBe("http://localhost:3000");
  });

  it("does not use localhost APP_BASE_URL on deployed runtimes when VERCEL_URL is set", () => {
    process.env.VERCEL_ENV = "production";
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.VERCEL_URL = "cleaning-service-software.vercel.app";
    expect(resolveNotificationAppBaseUrl()).toBe("https://cleaning-service-software.vercel.app");
  });

  it("prefers explicit hosted APP_BASE_URL on deployed runtimes", () => {
    process.env.VERCEL_ENV = "production";
    process.env.APP_BASE_URL = "https://cleaning-service-software.vercel.app";
    process.env.VERCEL_URL = "other-preview.vercel.app";
    expect(resolveNotificationAppBaseUrl()).toBe("https://cleaning-service-software.vercel.app");
  });

  it("treats Vercel preview as deployed runtime", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.VERCEL_URL = "cleaning-service-software.vercel.app";
    expect(isDeployedRuntime()).toBe(true);
    expect(resolveNotificationAppBaseUrl()).toBe("https://cleaning-service-software.vercel.app");
  });
});
