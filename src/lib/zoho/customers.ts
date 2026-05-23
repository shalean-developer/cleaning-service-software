import "server-only";

import { zohoBooksFetch, ZohoApiError } from "./zohoClient";

export type ZohoBooksContactRecord = {
  contact_id: string;
  contact_name?: string;
  email?: string;
  customer_name?: string;
};

type ZohoContactsListResponse = {
  code: number;
  message?: string;
  contacts?: ZohoBooksContactRecord[];
  contact?: ZohoBooksContactRecord;
};

export type FindZohoCustomerByEmailResult =
  | { ok: true; customerId: string; contactName: string | null }
  | { ok: false; code: "NOT_FOUND" }
  | { ok: false; code: "API_ERROR"; retryable: boolean };

export type CreateZohoCustomerResult =
  | { ok: true; customerId: string; contactName: string | null }
  | { ok: false; code: string; retryable: boolean };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function pickContactByEmail(
  contacts: ZohoBooksContactRecord[] | undefined,
  email: string,
): ZohoBooksContactRecord | null {
  if (!contacts?.length) return null;
  const target = normalizeEmail(email);
  return (
    contacts.find((contact) => contact.email && normalizeEmail(contact.email) === target) ?? null
  );
}

export async function findZohoCustomerByEmail(
  email: string,
): Promise<FindZohoCustomerByEmailResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { ok: false, code: "NOT_FOUND" };
  }

  try {
    const response = await zohoBooksFetch<ZohoContactsListResponse>(
      `/contacts?email=${encodeURIComponent(normalized)}`,
    );
    const match = pickContactByEmail(response.contacts, normalized);
    if (!match?.contact_id) {
      return { ok: false, code: "NOT_FOUND" };
    }
    return {
      ok: true,
      customerId: match.contact_id,
      contactName: match.contact_name?.trim() || match.customer_name?.trim() || null,
    };
  } catch (error) {
    return {
      ok: false,
      code: "API_ERROR",
      retryable: error instanceof ZohoApiError && error.statusCode >= 500,
    };
  }
}

export async function createZohoCustomer(input: {
  email: string;
  displayName?: string | null;
}): Promise<CreateZohoCustomerResult> {
  const email = input.email.trim();
  if (!email) {
    return { ok: false, code: "EMAIL_REQUIRED", retryable: false };
  }

  const contactName = input.displayName?.trim() || email.split("@")[0] || "Shalean customer";

  try {
    const response = await zohoBooksFetch<ZohoContactsListResponse>("/contacts", {
      method: "POST",
      body: JSON.stringify({
        contact_name: contactName,
        contact_type: "customer",
        email,
      }),
    });

    const customerId = response.contact?.contact_id?.trim();
    if (!customerId) {
      return { ok: false, code: "ZOHO_CUSTOMER_ID_MISSING", retryable: true };
    }

    return {
      ok: true,
      customerId,
      contactName: response.contact?.contact_name?.trim() || contactName,
    };
  } catch (error) {
    return {
      ok: false,
      code: error instanceof ZohoApiError ? error.code : "ZOHO_CUSTOMER_CREATE_FAILED",
      retryable: error instanceof ZohoApiError && error.statusCode >= 500,
    };
  }
}

export async function findOrCreateZohoCustomer(input: {
  email: string;
  displayName?: string | null;
}): Promise<CreateZohoCustomerResult> {
  const existing = await findZohoCustomerByEmail(input.email);
  if (existing.ok) {
    return {
      ok: true,
      customerId: existing.customerId,
      contactName: existing.contactName,
    };
  }
  if (existing.code === "API_ERROR" && existing.retryable) {
    return { ok: false, code: "ZOHO_CUSTOMER_LOOKUP_FAILED", retryable: true };
  }

  return createZohoCustomer(input);
}
