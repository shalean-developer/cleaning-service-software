import type { EarningPayoutStatus } from "@/lib/database/types";

export type EarningsCalculationResult = {
  cleanerId: string;
  grossAmountCents: number;
  payoutAmountCents: number;
  teamSize: number;
  ruleApplied: string;
  calculationMetadata: Record<string, unknown>;
};

export type RecordEarningsResult =
  | { ok: true; created: boolean; lineIds: string[] }
  | { ok: false; code: string; message: string };

export type PayoutQueueItem = {
  bookingId: string;
  customerLabel: string;
  serviceLabel: string;
  scheduleLabel: string;
  grossAmountCents: number;
  payoutAmountCents: number;
  earningCount: number;
  updatedAt: string;
};

export type CleanerEarningListItem = {
  id: string;
  bookingId: string | null;
  grossAmountCents: number;
  payoutAmountCents: number;
  payoutStatus: EarningPayoutStatus;
  serviceLabel: string;
  scheduleLabel: string;
  createdAt: string;
};
