export function redactPaymentUrlForAudit(paymentUrl: string): string {
  try {
    const url = new URL(paymentUrl);
    const path =
      url.pathname.length > 28 ? `${url.pathname.slice(0, 28)}…` : url.pathname;
    return `${url.origin}${path}`;
  } catch {
    return "[invalid-payment-url]";
  }
}
