export const ADMIN_BOOKING_WIZARD_STEPS = [
  "customer",
  "service",
  "schedule",
  "address",
  "pricing",
  "payment",
  "review",
  "confirmation",
] as const;

export type AdminBookingWizardStep = (typeof ADMIN_BOOKING_WIZARD_STEPS)[number];

export type AdminBookingWizardSummary = {
  customerLabel: string;
  serviceLabel: string;
  scheduleLabel: string;
  addressLabel: string;
  totalLabel: string;
  paymentLabel: string;
  lifecyclePreview: string;
};
