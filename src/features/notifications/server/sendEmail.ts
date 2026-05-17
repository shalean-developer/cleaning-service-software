import "server-only";

import { dryRunProvider } from "./dryRunProvider";
import type { SendEmailParams, SendEmailResult } from "./notificationEmailProviderTypes";
import { resendProvider } from "./resendProvider";

export type { EmailSender, SendEmailParams, SendEmailResult } from "./notificationEmailProviderTypes";
export {
  resolveActiveNotificationEmailProvider,
  resolveNotificationEmailSender,
} from "./notificationEmailProviderFactory";

/**
 * Dry-run transport: never calls Resend; safe for staging and unit tests.
 */
export async function sendEmailDryRun(params: SendEmailParams): Promise<SendEmailResult> {
  return dryRunProvider.send(params);
}

/**
 * Default transactional sender (Resend).
 */
export async function sendEmailViaResend(params: SendEmailParams): Promise<SendEmailResult> {
  return resendProvider.send(params);
}
