import "server-only";

/**
 * Inclusive VAT: VAT = gross * rate / (100 + rate)
 * Example: R115 gross at 15% → R15 VAT, R100 net excluding VAT.
 */
export function calculateInclusiveVat(
  grossCents: number,
  vatRate: number,
  vatRegistered = true,
): number {
  if (!vatRegistered || grossCents === 0 || vatRate <= 0) return 0;

  const sign = grossCents < 0 ? -1 : 1;
  const absGross = Math.abs(grossCents);
  const vat = Math.round((absGross * vatRate) / (100 + vatRate));
  return sign * vat;
}

export function calculateNetExcludingVat(
  grossCents: number,
  vatRate: number,
  vatRegistered = true,
): number {
  if (!vatRegistered) return grossCents;
  return grossCents - calculateInclusiveVat(grossCents, vatRate, vatRegistered);
}

export function calculateSignedVatForLineItem(
  signedGrossCents: number,
  vatRate: number,
  vatRegistered = true,
): number {
  return calculateInclusiveVat(signedGrossCents, vatRate, vatRegistered);
}
