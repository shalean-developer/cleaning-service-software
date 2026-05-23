import "server-only";

/** Formats integer cents for display on invoice payment pages. */
export function formatInvoiceAmount(cents: number, currency: string): string {
  const code = currency.trim() || "ZAR";
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: code,
    }).format(cents / 100);
  } catch {
    return `${code} ${(cents / 100).toFixed(2)}`;
  }
}
