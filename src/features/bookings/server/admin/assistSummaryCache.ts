import type { AdminBookingAssistSummary } from "./loadAdminBookingAssistSummary";
import {
  recordAssistSummaryCacheHit,
  recordAssistSummaryCacheMiss,
} from "./adminAssistedProductionObservability";

const TTL_MS = 5_000;

type CacheEntry = {
  expiresAt: number;
  summary: AdminBookingAssistSummary;
};

const cache = new Map<string, CacheEntry>();

export function getCachedAssistSummary(bookingId: string): AdminBookingAssistSummary | null {
  const entry = cache.get(bookingId);
  if (!entry) {
    recordAssistSummaryCacheMiss();
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    cache.delete(bookingId);
    recordAssistSummaryCacheMiss();
    return null;
  }
  recordAssistSummaryCacheHit();
  return entry.summary;
}

export function setCachedAssistSummary(bookingId: string, summary: AdminBookingAssistSummary): void {
  cache.set(bookingId, { expiresAt: Date.now() + TTL_MS, summary });
}

export function invalidateAssistSummaryCache(bookingId: string): void {
  cache.delete(bookingId);
}

/** @internal test helper */
export function clearAssistSummaryCacheForTests(): void {
  cache.clear();
}

export const ASSIST_SUMMARY_CACHE_TTL_MS = TTL_MS;
