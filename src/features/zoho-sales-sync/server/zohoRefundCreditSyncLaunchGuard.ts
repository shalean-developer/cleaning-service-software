import "server-only";

import { isZohoBooksEnabled } from "@/lib/zoho/zohoEnv";

export type ZohoRefundCreditSyncGateResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

function readFeatureFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw !== "false" && raw !== "0";
}

export function isZohoRefundCreditSyncEnabled(): boolean {
  return readFeatureFlag("ZOHO_REFUND_CREDIT_SYNC_ENABLED", false);
}

export function requireZohoRefundCreditSyncEnabled(): ZohoRefundCreditSyncGateResult {
  if (!isZohoRefundCreditSyncEnabled()) {
    return {
      ok: false,
      code: "REFUND_CREDIT_SYNC_DISABLED",
      message: "Zoho refund/credit sync is disabled.",
    };
  }
  if (!isZohoBooksEnabled()) {
    return {
      ok: false,
      code: "ZOHO_NOT_CONFIGURED",
      message: "Zoho Books is not configured.",
    };
  }
  return { ok: true };
}
