import "server-only";

export type NotificationEmailProviderName = "dry_run" | "resend";

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true; messageId: string; provider?: NotificationEmailProviderName }
  | {
      ok: false;
      error: string;
      retryable: boolean;
      provider?: NotificationEmailProviderName;
    };

export type EmailSender = (params: SendEmailParams) => Promise<SendEmailResult>;

export interface NotificationEmailProviderPort {
  readonly providerName: NotificationEmailProviderName;
  isReady(): boolean;
  send(params: SendEmailParams): Promise<SendEmailResult>;
}
