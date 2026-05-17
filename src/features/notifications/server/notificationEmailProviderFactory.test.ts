import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resendSendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = {
      send: (...args: unknown[]) => resendSendMock(...args),
    };
  },
}));

describe("notificationEmailProviderFactory", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...envBackup };
    process.env.ENABLE_NOTIFICATION_DELIVERY = "true";
    process.env.NOTIFICATION_FROM_EMAIL = "bookings@example.com";
    process.env.APP_BASE_URL = "https://cleaning-service-software.vercel.app";
  });

  afterEach(() => {
    process.env = envBackup;
    vi.resetModules();
  });

  it("selects dry_run provider when configured", async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "dry_run";
    process.env.RESEND_API_KEY = "re_test";

    const { resolveActiveNotificationEmailProvider } = await import(
      "./notificationEmailProviderFactory"
    );
    const provider = resolveActiveNotificationEmailProvider();
    expect(provider.providerName).toBe("dry_run");
    expect(provider.isReady()).toBe(true);
  });

  it("selects resend provider when configured", async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test";

    const { resolveActiveNotificationEmailProvider } = await import(
      "./notificationEmailProviderFactory"
    );
    const provider = resolveActiveNotificationEmailProvider();
    expect(provider.providerName).toBe("resend");
    expect(provider.isReady()).toBe(true);
  });

  it("resolveNotificationEmailSender uses dry_run without calling Resend", async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "dry_run";
    process.env.RESEND_API_KEY = "re_test";

    const { resolveNotificationEmailSender } = await import("./notificationEmailProviderFactory");
    const sender = resolveNotificationEmailSender();
    const result = await sender({
      to: "customer@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageId).toMatch(/^dry_run_/);
      expect(result.provider).toBe("dry_run");
    }
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it("resolveNotificationEmailSender uses resend when configured", async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test";
    resendSendMock.mockResolvedValue({ data: { id: "msg-1" }, error: null });

    const { resolveNotificationEmailSender } = await import("./notificationEmailProviderFactory");
    const sender = resolveNotificationEmailSender();
    await sender({
      to: "customer@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(resendSendMock).toHaveBeenCalledOnce();
  });
});
