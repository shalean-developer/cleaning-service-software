import type { AdminBookingWizardStep } from "./types";

export const ADMIN_BOOKING_WIZARD_STEP_LABELS: Record<AdminBookingWizardStep, string> = {
  customer: "Customer",
  service: "Service",
  schedule: "Schedule",
  address: "Address",
  pricing: "Pricing",
  payment: "Payment",
  review: "Review",
  confirmation: "Confirmation",
};

export const ADMIN_BOOKING_WIZARD_PHASE_LABEL = "Phase 1 — design preview (read-only)";
