import "server-only";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function maskCustomerEmailForDiagnostics(email: string | null | undefined): string | null {
  if (!email?.trim()) return null;
  const trimmed = email.trim();
  if (!EMAIL_PATTERN.test(trimmed)) return "[redacted-email]";
  const at = trimmed.indexOf("@");
  if (at <= 0) return "[redacted-email]";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const maskedLocal = local.length <= 1 ? "*" : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}

export function sanitizeReconcileErrorForDiagnostics(
  error: string | null | undefined,
): string | null {
  if (!error?.trim()) return null;
  const trimmed = error.trim();
  if (trimmed.length > 120) {
    return `${trimmed.slice(0, 120)}…`;
  }
  return trimmed;
}
