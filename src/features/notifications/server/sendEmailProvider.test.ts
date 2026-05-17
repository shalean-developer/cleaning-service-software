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

  it("dry_run does not call Resend", async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "dry_run";
    process.env.RESEND_API_KEY = "re_test";

    const { sendEmailDryRun, resolveNotificationEmailSender } = await import("./sendEmail");
    const sender = resolveNotificationEmailSender();
    expect(sender).toBe(sendEmailDryRun);

    const result = await sender({
      to: "customer@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageId).toMatch(/^dry_run_/);
    }
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it("resend provider calls Resend when configured", async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test";
    resendSendMock.mockResolvedValue({ data: { id: "msg-1" }, error: null });

    const { resolveNotificationEmailSender } = await import("./sendEmail");
    const sender = resolveNotificationEmailSender();
    await sender({
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
    expect(resendSendMock).not.toHaveBeenCalled();
  });
});
