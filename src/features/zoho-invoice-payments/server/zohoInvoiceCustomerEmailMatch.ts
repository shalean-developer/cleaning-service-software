import "server-only";

export function normalizeCustomerEmailForMatch(email: string): string {
  return email.trim().toLowerCase();
}

export function customerEmailsMatchForZohoCharge(
  invoiceEmail: string,
  savedMethodEmail: string,
): boolean {
  return (
    normalizeCustomerEmailForMatch(invoiceEmail) ===
    normalizeCustomerEmailForMatch(savedMethodEmail)
  );
}
