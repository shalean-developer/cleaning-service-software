import { z } from "zod";

export const ADMIN_CUSTOMERS_DEFAULT_LIMIT = 50;
export const ADMIN_CUSTOMERS_MAX_LIMIT = 100;
export const ADMIN_CUSTOMERS_MAX_PAGE = 10_000;
export const MIN_ADMIN_CUSTOMER_SEARCH_LENGTH = 2;
export const ADMIN_CUSTOMERS_SEARCH_SCAN_CAP = 2_000;

export const ADMIN_CUSTOMERS_BOOKINGS_FILTERS = [
  "all",
  "has_bookings",
  "no_bookings",
] as const;

export const ADMIN_CUSTOMERS_HEALTH_FILTERS = [
  "all",
  "healthy",
  "needs_attention",
] as const;

export const ADMIN_CUSTOMERS_ACTIVITY_FILTERS = [
  "all",
  "created_last_7_days",
  "created_last_30_days",
  "active_last_30_days",
] as const;

export type AdminCustomersBookingsFilter =
  (typeof ADMIN_CUSTOMERS_BOOKINGS_FILTERS)[number];
export type AdminCustomersHealthFilter = (typeof ADMIN_CUSTOMERS_HEALTH_FILTERS)[number];
export type AdminCustomersActivityFilter =
  (typeof ADMIN_CUSTOMERS_ACTIVITY_FILTERS)[number];

const adminCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(ADMIN_CUSTOMERS_MAX_PAGE).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(ADMIN_CUSTOMERS_MAX_LIMIT)
    .default(ADMIN_CUSTOMERS_DEFAULT_LIMIT),
  q: z
    .string()
    .trim()
    .min(MIN_ADMIN_CUSTOMER_SEARCH_LENGTH)
    .max(120)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  bookings: z.enum(ADMIN_CUSTOMERS_BOOKINGS_FILTERS).default("all"),
  health: z.enum(ADMIN_CUSTOMERS_HEALTH_FILTERS).default("all"),
  activity: z.enum(ADMIN_CUSTOMERS_ACTIVITY_FILTERS).default("all"),
});

export type ParsedAdminCustomersQuery = z.infer<typeof adminCustomersQuerySchema>;

export function parseAdminCustomersQueryParams(
  searchParams: URLSearchParams,
): ParsedAdminCustomersQuery {
  const raw = {
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    bookings: searchParams.get("bookings") ?? undefined,
    health: searchParams.get("health") ?? undefined,
    activity: searchParams.get("activity") ?? undefined,
  };
  return adminCustomersQuerySchema.parse(raw);
}

/** Escape `%`, `_`, and `\` for Postgres ILIKE patterns. */
export function escapeAdminCustomerIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/[%_]/g, (ch) => `\\${ch}`);
}

export function encodePostgrestOrLiteral(value: string): string {
  if (/[,()]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
