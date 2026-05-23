import "server-only";

import { mapPaystackWebhookChargeFailed, mapPaystackWebhookChargeSuccess } from "./mapPaystackCharge";
import { processPaystackChargeFailure } from "./processPaystackChargeFailure";
import { processPaystackChargeSuccess } from "./upsertBookingFromPaystack";
import type { PaystackWebhookEvent } from "./paystackTypes";
import {
  detectPaystackWebhookPaymentSource,
  readAuthorizationChargeIdFromMetadata,
  readZohoInvoicePaymentIdFromMetadata,
} from "./detectPaystackWebhookPaymentSource";
import { processZohoInvoiceChargeFailure } from "@/features/zoho-invoice-payments/server/processZohoInvoiceChargeFailure";
import { processZohoInvoiceChargeSuccess } from "@/features/zoho-invoice-payments/server/processZohoInvoiceChargeSuccess";
import { processZohoInvoiceAuthorizationChargeFailure } from "@/features/zoho-invoice-payments/server/processZohoInvoiceAuthorizationChargeFailure";
import { processZohoInvoiceAuthorizationChargeSuccess } from "@/features/zoho-invoice-payments/server/processZohoInvoiceAuthorizationChargeSuccess";
import { logZohoInvoicePaymentEvent } from "@/lib/zoho/zohoInvoicePaymentLogger";

export type WebhookHandlerResult =
  | {
      ok: true;
      handled: true;
      idempotent: boolean;
      status: string;
      source?: "booking" | "zoho_invoice" | "zoho_invoice_authorization_charge";
      bookingId?: string;
      invoiceNumber?: string;
    }
  | { ok: true; handled: false; reason: string }
  | { ok: false; code: string; message: string; status: number };

function invalidPayload(message: string): WebhookHandlerResult {
  return {
    ok: false,
    code: "INVALID_PAYLOAD",
    message,
    status: 400,
  };
}

async function routeBookingChargeSuccess(
  event: PaystackWebhookEvent,
): Promise<WebhookHandlerResult> {
  const charge = mapPaystackWebhookChargeSuccess(event);
  if (!charge) {
    return invalidPayload("charge.success payload could not be mapped.");
  }

  const result = await processPaystackChargeSuccess(charge, "webhook");
  if (!result.ok) {
    const status =
      result.code === "AMOUNT_MISMATCH"
        ? 409
        : result.code === "PAYMENT_NOT_FOUND"
          ? 404
          : 400;
    return {
      ok: false,
      code: result.code,
      message: result.message,
      status,
    };
  }

  return {
    ok: true,
    handled: true,
    idempotent: result.idempotent,
    bookingId: result.bookingId,
    status: result.status,
    source: "booking",
  };
}

async function routeBookingChargeFailure(
  event: PaystackWebhookEvent,
): Promise<WebhookHandlerResult> {
  const failedCharge = mapPaystackWebhookChargeFailed(event);
  if (!failedCharge) {
    return invalidPayload("charge.failed payload could not be mapped.");
  }

  const failureResult = await processPaystackChargeFailure(failedCharge);
  if (!failureResult.ok) {
    return {
      ok: false,
      code: failureResult.code,
      message: failureResult.message,
      status: failureResult.code === "PERSISTENCE_ERROR" ? 500 : 400,
    };
  }

  if (!failureResult.handled) {
    return {
      ok: true,
      handled: false,
      reason: failureResult.reason,
    };
  }

  return {
    ok: true,
    handled: true,
    idempotent: failureResult.idempotent,
    bookingId: failureResult.bookingId,
    status: failureResult.status,
    source: "booking",
  };
}

async function routeZohoChargeSuccess(
  event: PaystackWebhookEvent,
): Promise<WebhookHandlerResult> {
  const charge = mapPaystackWebhookChargeSuccess(event);
  if (!charge) {
    return invalidPayload("charge.success payload could not be mapped.");
  }

  logZohoInvoicePaymentEvent("zoho_invoice_webhook_routed", {
    eventType: event.event,
    paystackReference: charge.reference,
    zohoInvoicePaymentId: readZohoInvoicePaymentIdFromMetadata(charge.metadata),
  });

  const result = await processZohoInvoiceChargeSuccess(charge, event.event);
  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      status: result.code === "PERSISTENCE_ERROR" ? 500 : 400,
    };
  }

  if (!result.handled) {
    return {
      ok: true,
      handled: false,
      reason: result.reason,
    };
  }

  return {
    ok: true,
    handled: true,
    idempotent: result.idempotent,
    invoiceNumber: result.invoiceNumber,
    status: result.status,
    source: "zoho_invoice",
  };
}

async function routeZohoChargeFailure(
  event: PaystackWebhookEvent,
): Promise<WebhookHandlerResult> {
  const failedCharge = mapPaystackWebhookChargeFailed(event);
  if (!failedCharge) {
    return invalidPayload("charge.failed payload could not be mapped.");
  }

  logZohoInvoicePaymentEvent("zoho_invoice_webhook_routed", {
    eventType: event.event,
    paystackReference: failedCharge.reference,
    zohoInvoicePaymentId: readZohoInvoicePaymentIdFromMetadata(failedCharge.metadata),
  });

  const result = await processZohoInvoiceChargeFailure(failedCharge, event.event);
  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      status: result.code === "PERSISTENCE_ERROR" ? 500 : 400,
    };
  }

  if (!result.handled) {
    return {
      ok: true,
      handled: false,
      reason: result.reason,
    };
  }

  return {
    ok: true,
    handled: true,
    idempotent: result.idempotent,
    invoiceNumber: result.invoiceNumber,
    status: result.status,
    source: "zoho_invoice",
  };
}

async function routeAuthorizationChargeSuccess(
  event: PaystackWebhookEvent,
): Promise<WebhookHandlerResult> {
  const charge = mapPaystackWebhookChargeSuccess(event);
  if (!charge) {
    return invalidPayload("charge.success payload could not be mapped.");
  }

  logZohoInvoicePaymentEvent("zoho_invoice_authorization_charge_webhook_routed", {
    eventType: event.event,
    paystackReference: charge.reference,
    authorizationChargeId: readAuthorizationChargeIdFromMetadata(charge.metadata),
  });

  const result = await processZohoInvoiceAuthorizationChargeSuccess(charge, event.event);
  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      status: result.code === "PERSISTENCE_ERROR" ? 500 : 400,
    };
  }

  if (!result.handled) {
    return {
      ok: true,
      handled: false,
      reason: result.reason,
    };
  }

  return {
    ok: true,
    handled: true,
    idempotent: result.idempotent,
    invoiceNumber: result.invoiceNumber,
    status: result.status,
    source: "zoho_invoice_authorization_charge",
  };
}

async function routeAuthorizationChargeFailure(
  event: PaystackWebhookEvent,
): Promise<WebhookHandlerResult> {
  const failedCharge = mapPaystackWebhookChargeFailed(event);
  if (!failedCharge) {
    return invalidPayload("charge.failed payload could not be mapped.");
  }

  logZohoInvoicePaymentEvent("zoho_invoice_authorization_charge_webhook_routed", {
    eventType: event.event,
    paystackReference: failedCharge.reference,
    authorizationChargeId: readAuthorizationChargeIdFromMetadata(failedCharge.metadata),
  });

  const result = await processZohoInvoiceAuthorizationChargeFailure(failedCharge, event.event);
  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      status: result.code === "PERSISTENCE_ERROR" ? 500 : 400,
    };
  }

  if (!result.handled) {
    return {
      ok: true,
      handled: false,
      reason: result.reason,
    };
  }

  return {
    ok: true,
    handled: true,
    idempotent: result.idempotent,
    invoiceNumber: result.invoiceNumber,
    status: result.status,
    source: "zoho_invoice_authorization_charge",
  };
}

/**
 * Routes a verified Paystack webhook event to booking or Zoho invoice handlers.
 */
export async function routePaystackWebhookEvent(
  event: PaystackWebhookEvent,
): Promise<WebhookHandlerResult> {
  if (event.event === "charge.failed") {
    const failedCharge = mapPaystackWebhookChargeFailed(event);
    if (!failedCharge) {
      return invalidPayload("charge.failed payload could not be mapped.");
    }

    const source = detectPaystackWebhookPaymentSource(
      failedCharge.metadata,
      failedCharge.reference,
    );
    if (source === "zoho_invoice_authorization_charge") {
      return routeAuthorizationChargeFailure(event);
    }
    if (source === "zoho_invoice") {
      return routeZohoChargeFailure(event);
    }
    return routeBookingChargeFailure(event);
  }

  if (event.event === "charge.success") {
    const charge = mapPaystackWebhookChargeSuccess(event);
    if (!charge) {
      return invalidPayload("charge.success payload could not be mapped.");
    }

    const source = detectPaystackWebhookPaymentSource(charge.metadata, charge.reference);
    if (source === "zoho_invoice_authorization_charge") {
      return routeAuthorizationChargeSuccess(event);
    }
    if (source === "zoho_invoice") {
      return routeZohoChargeSuccess(event);
    }
    return routeBookingChargeSuccess(event);
  }

  return { ok: true, handled: false, reason: `ignored:${event.event}` };
}
