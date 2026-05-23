import type { AdminCustomerSearchResult } from "./adminCustomerApi";

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function normalizePhone(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

export function findDuplicateCustomerWarnings(
  customers: AdminCustomerSearchResult[],
): string[] {
  const warnings: string[] = [];
  if (customers.length < 2) return warnings;

  const byEmail = new Map<string, AdminCustomerSearchResult[]>();
  const byPhone = new Map<string, AdminCustomerSearchResult[]>();

  for (const customer of customers) {
    const email = normalizeEmail(customer.email);
    if (email) {
      const list = byEmail.get(email) ?? [];
      list.push(customer);
      byEmail.set(email, list);
    }
    const phone = normalizePhone(customer.phone);
    if (phone) {
      const list = byPhone.get(phone) ?? [];
      list.push(customer);
      byPhone.set(phone, list);
    }
  }

  for (const [email, matches] of byEmail) {
    if (matches.length > 1) {
      warnings.push(
        `${matches.length} customers share email ${email}. Confirm you are selecting the correct profile.`,
      );
    }
  }

  for (const [phone, matches] of byPhone) {
    if (matches.length > 1) {
      warnings.push(
        `${matches.length} customers share phone ${matches[0]?.phone ?? phone}. Confirm you are selecting the correct profile.`,
      );
    }
  }

  return warnings;
}
