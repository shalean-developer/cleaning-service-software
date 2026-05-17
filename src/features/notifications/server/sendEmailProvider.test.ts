import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resendSendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = {
      send: (...args: unknown[]) => resendSendMock(...args),
    };
  },
}));

describe("notification email provider", () => {
  const envBackup = { ...process.env };

  beforeEach(async () => {
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

  it("dry_run provider does not call Resend", async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "dry_run";
    process.env.RESEND_API_KEY = "re_test";

    const { resolveActiveNotificationEmailProvider, sendEmailDryRun } = await import("./sendEmail");
    const provider = resolveActiveNotificationEmailProvider();
    expect(provider.providerName).toBe("dry_run");

    const result = await sendEmailDryRun({
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

  it("resend provider calls Resend when configured", async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test";
    resendSendMock.mockResolvedValue({ data: { id: "msg-1" }, error: null });

    const { resolveActiveNotificationEmailProvider, sendEmailViaResend } = await import("./sendEmail");
    expect(resolveActiveNotificationEmailProvider().providerName).toBe("resend");

    await sendEmailViaResend({
      to: "customer@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(resendSendMock).toHaveBeenCalledOnce();
  });

  it("resend provider fails closed when API key is missing", async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "resend";
    delete process.env.RESEND_API_KEY;

    const { sendEmailViaResend } = await import("./sendEmail");
    const result = await sendEmailViaResend({
      to: "customer@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(false);
      expect(result.provider).toBe("resend");
    }
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it("factory preserves dry_run env selection", async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "dry_run";
    const { resolveNotificationEmailSender } = await import("./sendEmail");
    const result = await resolveNotificationEmailSender()({
      to: "a@example.com",
      subject: "s",
      html: "h",
      text: "t",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.provider).toBe("dry_run");
    expect(resendSendMock).not.toHaveBeenCalled();
  });
});
