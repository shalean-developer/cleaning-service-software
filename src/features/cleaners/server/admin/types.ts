import type { CleanerOperationalState } from "../lifecycle/operationalState";
import type { CleanerOperationalAuditRow } from "@/lib/database/types";
import type { AssignmentOfferRow } from "@/lib/database/types";

export type AdminCleanerOperationalFilter =
  | "all"
  | "active"
  | "onboarding"
  | "inactive"
  | "suspended"
  | "archived";

export type AdminCleanerLastLifecycleAction = {
  action: string;
  outcome: string;
  createdAt: string;
};

export type AdminCleanerListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  operationalState: CleanerOperationalState;
  active: boolean;
  isSuspended: boolean;
  openOffersCount: number;
  activeBookingsCount: number;
  pendingEarningsCount: number;
  lastLifecycleAction: AdminCleanerLastLifecycleAction | null;
};

export type AdminCleanersListResult = {
  items: AdminCleanerListItem[];
  filter: AdminCleanerOperationalFilter;
  totalCount: number;
};

export type AdminCleanerSafetyCounts = {
  openOffersCount: number;
  activeBookingsCount: number;
  pendingEarningsCount: number;
};

export type AdminCleanerDetail = {
  id: string;
  profileId: string;
  name: string;
  email: string | null;
  phone: string | null;
  operationalState: CleanerOperationalState;
  active: boolean;
  suspendedAt: string | null;
  suspensionEndsAt: string | null;
  deletedAt: string | null;
  onboardingCompletedAt: string | null;
  lifecycleReason: string | null;
  averageRating: number | null;
  createdAt: string;
  updatedAt: string;
  safetyCounts: AdminCleanerSafetyCounts;
  auditLog: CleanerOperationalAuditRow[];
  openOffers: AssignmentOfferRow[];
  activeBookingIds: string[];
};
