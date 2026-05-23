import { findDuplicateCustomerWarnings } from "./customerDuplicates";

export type AdminCustomerSearchResult = {
  customerId: string;
  label: string;
  email: string | null;
  phone: string | null;
};

type ListCustomersResponse =
  | {
      ok: true;
      customers: {
        customerId: string;
        companyName: string;
        authEmail: string | null;
        phone: string | null;
      }[];
    }
  | { ok: false; error: string; message?: string };

type CreateCustomerResponse =
  | {
      ok: true;
      customer: {
        customerId: string;
        fullName: string;
        email: string;
        phone: string | null;
        warnings: string[];
      };
    }
  | { ok: false; error: string; message?: string };

export async function searchAdminCustomers(
  query: string,
): Promise<
  | { ok: true; customers: AdminCustomerSearchResult[]; duplicateWarnings: string[] }
  | { ok: false; message: string }
> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { ok: false, message: "Enter at least 2 characters to search." };
  }

  const params = new URLSearchParams({ q: trimmed, limit: "20" });
  const response = await fetch(`/api/admin/customers?${params.toString()}`);
  const json = (await response.json()) as ListCustomersResponse;

  if (!response.ok || !json.ok) {
    return {
      ok: false,
      message: "message" in json && json.message ? json.message : "Customer search failed.",
    };
  }

  const customers = json.customers.map((row) => ({
    customerId: row.customerId,
    label: row.companyName.trim() || row.authEmail || row.customerId.slice(0, 8),
    email: row.authEmail,
    phone: row.phone,
  }));

  return {
    ok: true,
    customers,
    duplicateWarnings: findDuplicateCustomerWarnings(customers),
  };
}

export async function createAdminCustomer(input: {
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
}): Promise<
  | {
      ok: true;
      customer: AdminCustomerSearchResult;
      warnings: string[];
      idempotent: boolean;
    }
  | { ok: false; message: string }
> {
  const response = await fetch("/api/admin/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: input.fullName.trim(),
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
    }),
  });

  const json = (await response.json()) as CreateCustomerResponse;
  if (!response.ok || !json.ok) {
    return {
      ok: false,
      message: "message" in json && json.message ? json.message : "Could not create customer.",
    };
  }

  return {
    ok: true,
    customer: {
      customerId: json.customer.customerId,
      label: json.customer.fullName.trim() || json.customer.email,
      email: json.customer.email,
      phone: json.customer.phone,
    },
    warnings: json.customer.warnings,
    idempotent: json.customer.warnings.includes("Customer already exists"),
  };
}
