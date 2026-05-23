export const ADMIN_OFFLINE_PAYMENT_RAILS = ["eft", "cash", "card_machine"] as const;

export type AdminOfflinePaymentRail = (typeof ADMIN_OFFLINE_PAYMENT_RAILS)[number];

export function isAdminOfflinePaymentRail(value: string): value is AdminOfflinePaymentRail {
  return (ADMIN_OFFLINE_PAYMENT_RAILS as readonly string[]).includes(value);
}
