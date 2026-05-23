import "server-only";

import { isZohoBooksEnabled } from "@/lib/zoho/zohoEnv";

export type ZohoSalesSyncGateResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

function readFeatureFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw !== "false" && raw !== "0";
}

export function isZohoSalesSyncEnabled(): boolean {
  return readFeatureFlag("ZOHO_SALES_SYNC_ENABLED", false);
}

export function requireZohoSalesSyncEnabled(): ZohoSalesSyncGateResult {
  if (!isZohoSalesSyncEnabled()) {
    return {
      ok: false,
      code: "SALES_SYNC_DISABLED",
      message: "Zoho sales sync is disabled.",
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
