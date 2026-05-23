import type { Json } from "@/lib/database/types";

export type ServiceAuthorizationMetadata = {
  authorized: true;
  authorizedAt: string;
  authorizedByAdminProfileId: string;
  reason: string;
  source: "admin_monthly_billing" | "recurring_monthly_account_authorization";
  authorizationId?: string;
};

export type MonthlyAccountBillingMetadata = {
  mode: "monthly_account";
  monthlyAccountId?: string;
  zohoCustomerId?: string;
  billingEmail?: string;
  billingTerms?: string;
  serviceAuthorization?: ServiceAuthorizationMetadata;
  invoiceBatchId?: string;
  source?: string;
  configuredByAdminProfileId?: string;
  configuredAt?: string;
};

function readBillingRecord(metadata: Json): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const billing = (metadata as Record<string, unknown>).billing;
  if (!billing || typeof billing !== "object" || Array.isArray(billing)) {
    return null;
  }
  return billing as Record<string, unknown>;
}

export function isMonthlyAccountBillingMetadata(metadata: Json): boolean {
  const billing = readBillingRecord(metadata);
  return billing?.mode === "monthly_account";
}

export function parseMonthlyAccountBillingMetadata(
  metadata: Json,
): MonthlyAccountBillingMetadata | null {
  const billing = readBillingRecord(metadata);
  if (!billing || billing.mode !== "monthly_account") return null;

  const serviceAuthorizationRaw = billing.serviceAuthorization;
  let serviceAuthorization: ServiceAuthorizationMetadata | undefined;
  if (
    serviceAuthorizationRaw &&
    typeof serviceAuthorizationRaw === "object" &&
    !Array.isArray(serviceAuthorizationRaw)
  ) {
    const sa = serviceAuthorizationRaw as Record<string, unknown>;
    if (sa.authorized === true) {
      serviceAuthorization = {
        authorized: true,
        authorizedAt: String(sa.authorizedAt ?? ""),
        authorizedByAdminProfileId: String(sa.authorizedByAdminProfileId ?? ""),
        reason: String(sa.reason ?? ""),
        source:
          sa.source === "recurring_monthly_account_authorization"
            ? "recurring_monthly_account_authorization"
            : "admin_monthly_billing",
        authorizationId:
          typeof sa.authorizationId === "string" ? sa.authorizationId : undefined,
      };
    }
  }

  return {
    mode: "monthly_account",
    monthlyAccountId:
      typeof billing.monthlyAccountId === "string" ? billing.monthlyAccountId : undefined,
    zohoCustomerId:
      typeof billing.zohoCustomerId === "string" ? billing.zohoCustomerId : undefined,
    billingEmail: typeof billing.billingEmail === "string" ? billing.billingEmail : undefined,
    billingTerms: typeof billing.billingTerms === "string" ? billing.billingTerms : undefined,
    serviceAuthorization,
    invoiceBatchId:
      typeof billing.invoiceBatchId === "string" ? billing.invoiceBatchId : undefined,
    source: typeof billing.source === "string" ? billing.source : undefined,
    configuredByAdminProfileId:
      typeof billing.configuredByAdminProfileId === "string"
        ? billing.configuredByAdminProfileId
        : undefined,
    configuredAt: typeof billing.configuredAt === "string" ? billing.configuredAt : undefined,
  };
}

export function mergeServiceAuthorizationIntoBookingMetadata(
  metadata: Json,
  serviceAuthorization: ServiceAuthorizationMetadata,
): Json {
  const root =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  const billingRaw = root.billing;
  const billing =
    billingRaw && typeof billingRaw === "object" && !Array.isArray(billingRaw)
      ? { ...(billingRaw as Record<string, unknown>) }
      : {};
  billing.serviceAuthorization = serviceAuthorization;
  root.billing = billing;
  return root as Json;
}

export function bookingHasRecurringScheduleMetadata(metadata: Json): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  const record = metadata as Record<string, unknown>;
  if (record.recurringSchedule != null) return true;
  const quote =
    record.quote != null && typeof record.quote === "object" && !Array.isArray(record.quote)
      ? (record.quote as Record<string, unknown>)
      : null;
  const quoteInput =
    quote?.input != null && typeof quote.input === "object" && !Array.isArray(quote.input)
      ? (quote.input as Record<string, unknown>)
      : null;
  const frequency =
    (typeof record.frequency === "string" ? record.frequency : null) ??
    (typeof quote?.frequency === "string" ? quote.frequency : null) ??
    (typeof quoteInput?.frequency === "string" ? quoteInput.frequency : null);
  return frequency != null && frequency !== "once";
}
