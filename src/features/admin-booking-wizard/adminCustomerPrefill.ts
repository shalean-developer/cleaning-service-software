import type { AdminCustomerSearchResult } from "./adminCustomerApi";

type CustomerDetailResponse =
  | {
      ok: true;
      customer: {
        customerId: string;
        companyName: string;
        authEmail: string | null;
        phone: string | null;
        profileFullName: string | null;
      };
    }
  | { ok: false; error: string; message?: string };

type AdminCustomerDetail = Extract<CustomerDetailResponse, { ok: true }>["customer"];

export function mapAdminCustomerDetailToSearchResult(
  customer: AdminCustomerDetail,
): AdminCustomerSearchResult {
  const label =
    customer.companyName?.trim() ||
    customer.profileFullName?.trim() ||
    customer.authEmail?.trim() ||
    customer.customerId.slice(0, 8);

  return {
    customerId: customer.customerId,
    label,
    email: customer.authEmail,
    phone: customer.phone,
  };
}

export async function fetchAdminCustomerById(
  customerId: string,
): Promise<
  | { ok: true; customer: AdminCustomerSearchResult }
  | { ok: false; message: string }
> {
  const trimmed = customerId.trim();
  if (!trimmed) {
    return { ok: false, message: "Customer ID is required." };
  }

  const response = await fetch(`/api/admin/customers/${encodeURIComponent(trimmed)}`);
  const json = (await response.json()) as CustomerDetailResponse;

  if (!response.ok || !json.ok) {
    return {
      ok: false,
      message:
        "message" in json && json.message
          ? json.message
          : response.status === 404
            ? "Customer not found. Search or create a customer to continue."
            : "Could not load customer profile.",
    };
  }

  return { ok: true, customer: mapAdminCustomerDetailToSearchResult(json.customer) };
}
