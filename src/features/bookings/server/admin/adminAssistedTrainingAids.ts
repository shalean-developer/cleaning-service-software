export const ADMIN_ASSISTED_TRAINING_AIDS = [
  {
    id: "paystack_first",
    text: "Use the Paystack link first before recording an offline payment.",
  },
  {
    id: "offline_reconcile",
    text: "Offline payments require reconciliation — capture evidence reference and rail details.",
  },
  {
    id: "assignment_after_payment",
    text: "Assignment only starts after payment confirmation via the normal finalize path.",
  },
  {
    id: "regenerate_expired",
    text: "Use regenerate link when a payment request has expired — do not share stale URLs.",
  },
  {
    id: "no_email_whatsapp",
    text: "If the customer has no email, use Copy WhatsApp message instead of email request.",
  },
  {
    id: "pilot_real_flows",
    text: "Pilot dry-run bookings still use real payment and assignment flows — no bypass.",
  },
] as const;

export type AdminAssistedTrainingAid = (typeof ADMIN_ASSISTED_TRAINING_AIDS)[number];
