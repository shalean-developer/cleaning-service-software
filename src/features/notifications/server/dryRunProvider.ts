import "server-only";

import type {
  NotificationEmailProviderPort,
  SendEmailParams,
  SendEmailResult,
} from "./notificationEmailProviderTypes";

export class DryRunProvider implements NotificationEmailProviderPort {
  readonly providerName = "dry_run" as const;

  isReady(): boolean {
    return true;
  }

  async send(_params: SendEmailParams): Promise<SendEmailResult> {
    return { ok: true, messageId: `dry_run_${Date.now()}`, provider: this.providerName };
  }
}

export const dryRunProvider = new DryRunProvider();
