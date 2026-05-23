import "server-only";

export const ZOHO_API_LATENCY_WARNING_MS = 1500;

export type ZohoInvoiceFetchTiming = {
  durationMs: number;
  exceededLatencyWarning: boolean;
};

export async function measureZohoInvoiceFetch<T>(
  operation: () => Promise<T>,
): Promise<{ result: T; timing: ZohoInvoiceFetchTiming }> {
  const startedAt = Date.now();
  const result = await operation();
  const durationMs = Date.now() - startedAt;

  return {
    result,
    timing: {
      durationMs,
      exceededLatencyWarning: durationMs > ZOHO_API_LATENCY_WARNING_MS,
    },
  };
}
