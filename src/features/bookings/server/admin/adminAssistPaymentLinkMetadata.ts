import type { Json } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import { readAdminAssistMetadata } from "./adminAssistMetadata";

export type AdminAssistPaymentLinkDeliveryChannel =
  | "email"
  | "sms"
  | "whatsapp"
  | "copy_only";

export type AdminAssistPaymentLinkStatus = "active" | "superseded";

export type AdminAssistPaymentLinkMetadata = {
  paymentUrl: string;
  reference: string;
  expiresAt: string;
  generatedAt: string;
  generatedByProfileId: string;
  deliveryChannel: AdminAssistPaymentLinkDeliveryChannel;
  paymentId: string;
  status?: AdminAssistPaymentLinkStatus;
  supersededAt?: string;
};

export type AdminAssistPaymentRequestState =
  | "none"
  | "awaiting"
  | "link_active"
  | "link_expired";

export type AdminAssistPaymentRequestVisibility = {
  adminAssisted: boolean;
  state: AdminAssistPaymentRequestState;
  paymentLink: AdminAssistPaymentLinkMetadata | null;
  supersededLinks: AdminAssistPaymentLinkMetadata[];
};

function asRecord(metadata: Json | null | undefined): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  return metadata as Record<string, unknown>;
}

function parsePaymentLinkRow(row: Record<string, unknown>): AdminAssistPaymentLinkMetadata | null {
  if (
    typeof row.paymentUrl !== "string" ||
    typeof row.reference !== "string" ||
    typeof row.expiresAt !== "string" ||
    typeof row.generatedAt !== "string" ||
    typeof row.generatedByProfileId !== "string" ||
    typeof row.deliveryChannel !== "string" ||
    typeof row.paymentId !== "string"
  ) {
    return null;
  }
  return {
    paymentUrl: row.paymentUrl,
    reference: row.reference,
    expiresAt: row.expiresAt,
    generatedAt: row.generatedAt,
    generatedByProfileId: row.generatedByProfileId,
    deliveryChannel: row.deliveryChannel as AdminAssistPaymentLinkDeliveryChannel,
    paymentId: row.paymentId,
    status: row.status === "superseded" ? "superseded" : "active",
    supersededAt: typeof row.supersededAt === "string" ? row.supersededAt : undefined,
  };
}

export function readAdminAssistPaymentLinkMetadata(
  metadata: Json | null | undefined,
): AdminAssistPaymentLinkMetadata | null {
  const root = asRecord(metadata);
  if (!root) return null;
  const adminAssist = root.adminAssist;
  if (!adminAssist || typeof adminAssist !== "object" || Array.isArray(adminAssist)) {
    return null;
  }
  const link = (adminAssist as Record<string, unknown>).paymentLink;
  if (!link || typeof link !== "object" || Array.isArray(link)) {
    return null;
  }
  const parsed = parsePaymentLinkRow(link as Record<string, unknown>);
  if (!parsed || parsed.status === "superseded") {
    return null;
  }
  return parsed;
}

export function readAdminAssistSupersededPaymentLinks(
  metadata: Json | null | undefined,
): AdminAssistPaymentLinkMetadata[] {
  const root = asRecord(metadata);
  if (!root) return [];
  const adminAssist = root.adminAssist;
  if (!adminAssist || typeof adminAssist !== "object" || Array.isArray(adminAssist)) {
    return [];
  }
  const history = (adminAssist as Record<string, unknown>).paymentLinkHistory;
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) =>
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? parsePaymentLinkRow(entry as Record<string, unknown>)
        : null,
    )
    .filter((row): row is AdminAssistPaymentLinkMetadata => row != null);
}

export function mergeAdminAssistPaymentLinkMetadata(
  metadata: Json | null | undefined,
  link: AdminAssistPaymentLinkMetadata,
  options?: { supersededLinks?: AdminAssistPaymentLinkMetadata[] },
): Record<string, unknown> {
  const root = asRecord(metadata) ?? {};
  const existingAssist =
    root.adminAssist && typeof root.adminAssist === "object" && !Array.isArray(root.adminAssist)
      ? { ...(root.adminAssist as Record<string, unknown>) }
      : {};
  const parsedAssist = readAdminAssistMetadata(metadata);
  const history =
    options?.supersededLinks ??
    readAdminAssistSupersededPaymentLinks(metadata);
  return {
    ...root,
    adminAssist: {
      ...existingAssist,
      ...(parsedAssist ?? {}),
      paymentLink: { ...link, status: link.status ?? "active" },
      paymentLinkHistory: history,
    },
  };
}

export function supersedeAdminAssistPaymentLink(
  current: AdminAssistPaymentLinkMetadata,
  supersededAt: string = new Date().toISOString(),
): AdminAssistPaymentLinkMetadata {
  return {
    ...current,
    status: "superseded",
    supersededAt,
  };
}

export function isAdminAssistPaymentLinkActive(
  link: AdminAssistPaymentLinkMetadata | null,
  nowMs: number = Date.now(),
): boolean {
  if (!link) return false;
  if (link.status === "superseded") return false;
  const expiresMs = new Date(link.expiresAt).getTime();
  return Number.isFinite(expiresMs) && expiresMs > nowMs;
}

export function isAdminAssistPaymentLinkExpired(
  link: AdminAssistPaymentLinkMetadata | null,
  nowMs: number = Date.now(),
): boolean {
  if (!link) return false;
  if (link.status === "superseded") return false;
  const expiresMs = new Date(link.expiresAt).getTime();
  return Number.isFinite(expiresMs) && expiresMs <= nowMs;
}

export function formatAdminAssistPaymentLinkStatusLabel(
  link: AdminAssistPaymentLinkMetadata | null,
  nowMs: number = Date.now(),
): "active" | "expired" | "superseded" | "none" {
  if (!link) return "none";
  if (link.status === "superseded") return "superseded";
  if (isAdminAssistPaymentLinkActive(link, nowMs)) return "active";
  if (isAdminAssistPaymentLinkExpired(link, nowMs)) return "expired";
  return "none";
}

export function resolveAdminAssistPaymentRequestVisibility(
  metadata: Json | null | undefined,
  bookingStatus: BookingStatus,
  adminAssisted: boolean,
  nowMs: number = Date.now(),
): AdminAssistPaymentRequestVisibility {
  const paymentLink = readAdminAssistPaymentLinkMetadata(metadata);
  const supersededLinks = readAdminAssistSupersededPaymentLinks(metadata);

  if (!adminAssisted) {
    return {
      adminAssisted: false,
      state: "none",
      paymentLink: null,
      supersededLinks: [],
    };
  }

  if (bookingStatus === "pending_payment") {
    if (paymentLink && isAdminAssistPaymentLinkActive(paymentLink, nowMs)) {
      return {
        adminAssisted: true,
        state: "link_active",
        paymentLink,
        supersededLinks,
      };
    }
    if (
      paymentLink &&
      isAdminAssistPaymentLinkExpired(paymentLink, nowMs)
    ) {
      return {
        adminAssisted: true,
        state: "link_expired",
        paymentLink,
        supersededLinks,
      };
    }
    if (!paymentLink && supersededLinks.length > 0) {
      return {
        adminAssisted: true,
        state: "link_expired",
        paymentLink: null,
        supersededLinks,
      };
    }
    return {
      adminAssisted: true,
      state: "awaiting",
      paymentLink,
      supersededLinks,
    };
  }

  return {
    adminAssisted: true,
    state: paymentLink ? (isAdminAssistPaymentLinkActive(paymentLink, nowMs) ? "link_active" : "link_expired") : "none",
    paymentLink,
    supersededLinks,
  };
}
