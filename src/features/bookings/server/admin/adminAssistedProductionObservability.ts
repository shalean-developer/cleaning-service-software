import "server-only";

export type AdminAssistedObservabilityMetrics = {
  assistSummaryCacheHits: number;
  assistSummaryCacheMisses: number;
  assistSummaryCacheHitRate: number | null;
  productionLoadDurationMs: number | null;
  exportGenerationDurationMs: number | null;
  recurringEnrichmentDurationMs: number | null;
};

const metrics: AdminAssistedObservabilityMetrics = {
  assistSummaryCacheHits: 0,
  assistSummaryCacheMisses: 0,
  assistSummaryCacheHitRate: null,
  productionLoadDurationMs: null,
  exportGenerationDurationMs: null,
  recurringEnrichmentDurationMs: null,
};

export function recordAssistSummaryCacheHit(): void {
  metrics.assistSummaryCacheHits += 1;
  updateHitRate();
}

export function recordAssistSummaryCacheMiss(): void {
  metrics.assistSummaryCacheMisses += 1;
  updateHitRate();
}

function updateHitRate(): void {
  const total = metrics.assistSummaryCacheHits + metrics.assistSummaryCacheMisses;
  metrics.assistSummaryCacheHitRate =
    total > 0 ? Math.round((metrics.assistSummaryCacheHits / total) * 1000) / 10 : null;
}

export function recordProductionLoadDuration(ms: number): void {
  metrics.productionLoadDurationMs = Math.round(ms);
}

export function recordExportGenerationDuration(ms: number): void {
  metrics.exportGenerationDurationMs = Math.round(ms);
}

export function recordRecurringEnrichmentDuration(ms: number): void {
  metrics.recurringEnrichmentDurationMs = Math.round(ms);
}

export function getAdminAssistedObservabilityMetrics(): AdminAssistedObservabilityMetrics {
  return { ...metrics };
}

/** @internal test helper */
export function resetAdminAssistedObservabilityMetricsForTests(): void {
  metrics.assistSummaryCacheHits = 0;
  metrics.assistSummaryCacheMisses = 0;
  metrics.assistSummaryCacheHitRate = null;
  metrics.productionLoadDurationMs = null;
  metrics.exportGenerationDurationMs = null;
  metrics.recurringEnrichmentDurationMs = null;
}
