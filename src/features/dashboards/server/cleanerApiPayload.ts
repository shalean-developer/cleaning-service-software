/** Keys that must never appear on cleaner-facing API JSON payloads. */
export const CLEANER_API_FORBIDDEN_FINANCIAL_KEYS = [
  "priceCents",
  "priceLabel",
  "amountPaid",
  "totalPaid",
  "customerTotal",
  "grossAmountCents",
  "price_cents",
] as const;

export function collectForbiddenCleanerApiKeys(
  value: unknown,
  path = "",
): string[] {
  const hits: string[] = [];
  if (value == null || typeof value !== "object") {
    return hits;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      hits.push(...collectForbiddenCleanerApiKeys(item, `${path}[${index}]`));
    });
    return hits;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const keyPath = path ? `${path}.${key}` : key;
    if ((CLEANER_API_FORBIDDEN_FINANCIAL_KEYS as readonly string[]).includes(key)) {
      hits.push(keyPath);
    }
    hits.push(...collectForbiddenCleanerApiKeys(nested, keyPath));
  }

  return hits;
}

export function assertCleanerApiPayloadClean(value: unknown): void {
  const hits = collectForbiddenCleanerApiKeys(value);
  if (hits.length > 0) {
    throw new Error(
      `Cleaner API payload exposes forbidden customer financial fields: ${hits.join(", ")}`,
    );
  }
}
