import "server-only";

import { Resend } from "resend";
import { getNotificationDeliveryConfig } from "./config";

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; retryable: boolean };

export type EmailSender = (params: SendEmailParams) => Promise<SendEmailResult>;

function classifySendError(message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("timeout") || lower.includes("503")) {
    return true;
  }
  if (lower.includes("invalid") && lower.includes("email")) return false;
  if (lower.includes("not verified") || lower.includes("domain")) return false;
  return true;
}

/**
 * Default transactional sender (Resend). Postmark can be added later via the same port.
 */
export async function sendEmailViaResend(params: SendEmailParams): Promise<SendEmailResult> {
  const config = getNotificationDeliveryConfig();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !config.fromEmail) {
    return {
      ok: false,
      error: "Email provider is not configured.",
      retryable: false,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: config.fromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (error) {
      const message = error.message || "Resend send failed.";
      return { ok: false, error: message, retryable: classifySendError(message) };
    }

    return { ok: true, messageId: data?.id ?? "unknown" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Resend send failed.";
    return { ok: false, error: message, retryable: classifySendError(message) };
  }
}
