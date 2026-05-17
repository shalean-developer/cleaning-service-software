import "server-only";

import { Resend } from "resend";
import { classifyProviderFailure } from "./classifyProviderFailure";
import { getNotificationDeliveryConfig } from "./config";
import type {
  NotificationEmailProviderPort,
  SendEmailParams,
  SendEmailResult,
} from "./notificationEmailProviderTypes";

export class ResendProvider implements NotificationEmailProviderPort {
  readonly providerName = "resend" as const;

  isReady(): boolean {
    const config = getNotificationDeliveryConfig();
    return Boolean(process.env.RESEND_API_KEY?.trim() && config.fromEmail);
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const config = getNotificationDeliveryConfig();
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey || !config.fromEmail) {
      return {
        ok: false,
        error: "Email provider is not configured.",
        retryable: false,
        provider: this.providerName,
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
        return {
          ok: false,
          error: message,
          retryable: classifyProviderFailure(message).retryable,
          provider: this.providerName,
        };
      }

      return { ok: true, messageId: data?.id ?? "unknown", provider: this.providerName };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Resend send failed.";
      return {
        ok: false,
        error: message,
        retryable: classifyProviderFailure(message).retryable,
        provider: this.providerName,
      };
    }
  }
}

export const resendProvider = new ResendProvider();
