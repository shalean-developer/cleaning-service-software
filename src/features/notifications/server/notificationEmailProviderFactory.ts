import "server-only";

import { resolveNotificationEmailProvider } from "./config";
import { dryRunProvider } from "./dryRunProvider";
import type {
  EmailSender,
  NotificationEmailProviderPort,
} from "./notificationEmailProviderTypes";
import { resendProvider } from "./resendProvider";

export function resolveActiveNotificationEmailProvider(): NotificationEmailProviderPort {
  const mode = resolveNotificationEmailProvider();
  if (mode === "dry_run") {
    return dryRunProvider;
  }
  return resendProvider;
}

export function resolveNotificationEmailSender(): EmailSender {
  const provider = resolveActiveNotificationEmailProvider();
  return (params) => provider.send(params);
}
