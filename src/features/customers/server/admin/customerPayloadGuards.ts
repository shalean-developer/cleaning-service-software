/** Auth, identity, and booking ownership — never accepted on customer profile edit. */
export const FORBIDDEN_CUSTOMER_EDIT_KEYS = [
  "email",
  "authEmail",
  "auth_email",
  "password",
  "confirmPassword",
  "role",
  "profile_id",
  "profileId",
  "customer_id",
  "customerId",
  "id",
  "full_name",
  "fullName",
  "send_invite",
  "booking_id",
  "bookingId",
  "bookings",
] as const;

export function findForbiddenCustomerEditKeys(body: Record<string, unknown>): string[] {
  return FORBIDDEN_CUSTOMER_EDIT_KEYS.filter((key) => key in body);
}
