/**
 * Pure eligibility for admin "Dispatch now". safe to import from client-boundary modules.
 */

export function computeDeferredDispatchNowEligible(input: {
  bookingStatus: string;
  hasAssignedCleaner: boolean;
  hasPaidPayment: boolean;
  assignmentDispatchAt: string | null | undefined;
  openOfferCount: number;
}): boolean {
  if (input.bookingStatus !== "confirmed") return false;
  if (input.hasAssignedCleaner) return false;
  if (!input.hasPaidPayment) return false;
  if (!input.assignmentDispatchAt) return false;
  if (input.openOfferCount > 0) return false;
  return true;
}
