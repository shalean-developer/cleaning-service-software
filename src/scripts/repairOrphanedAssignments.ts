import type { SupabaseClient } from "@supabase/supabase-js";
import { readAssignmentMetadata } from "@/features/assignments/server/assignmentMetadata";
import { runAssignmentAfterPayment } from "@/features/assignments/server/runAssignmentAfterPayment";
import type { RunAssignmentResult } from "@/features/assignments/server/types";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import type { Database } from "@/lib/database/types";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

/** Matches `scripts/e2e/lib/constants.mjs` E2E_PREFIX — keep in sync for repair safety scope. */
export const E2E_CUSTOMER_PREFIX = "test_e2e_";

export function isE2eCustomerCompanyName(name: string | null | undefined): boolean {
  return typeof name === "string" && name.startsWith(E2E_CUSTOMER_PREFIX);
}

/**
 * Pending-assignment booking with no open (`offered`) assignment_offer row.
 * Safe to re-run post-payment assignment dispatch.
 */
export function isOrphanedPendingAssignmentCandidate(
  booking: { status: string },
  offers: ReadonlyArray<{ status: string }>,
): boolean {
  if (booking.status !== "pending_assignment") return false;
  return !offers.some((o) => o.status === "offered");
}

export type OrphanedBookingCandidate = {
  bookingId: string;
  customerId: string;
  companyName: string;
  assignmentMeta: ReturnType<typeof readAssignmentMetadata>;
  offerStatuses: string[];
};

export async function findOrphanedE2eAssignmentBookings(
  client: SupabaseClient<Database>,
): Promise<OrphanedBookingCandidate[]> {
  const { data: customers, error: custErr } = await client
    .from("customers")
    .select("id, company_name")
    .like("company_name", `${E2E_CUSTOMER_PREFIX}%`);

  if (custErr) throw new Error(custErr.message);

  const e2eCustomers = (customers ?? []).filter((c) =>
    isE2eCustomerCompanyName(c.company_name),
  );
  const customerIds = e2eCustomers.map((c) => c.id);
  if (customerIds.length === 0) return [];

  const { data: bookings, error: bookErr } = await client
    .from("bookings")
    .select("id, status, customer_id, metadata")
    .eq("status", "pending_assignment")
    .in("customer_id", customerIds);

  if (bookErr) throw new Error(bookErr.message);

  const rows: OrphanedBookingCandidate[] = [];

  for (const booking of bookings ?? []) {
    const { data: offers, error: offerErr } = await client
      .from("assignment_offers")
      .select("id, status")
      .eq("booking_id", booking.id);

    if (offerErr) throw new Error(offerErr.message);
    if (!isOrphanedPendingAssignmentCandidate(booking, offers ?? [])) continue;

    const customer = e2eCustomers.find((c) => c.id === booking.customer_id);

    rows.push({
      bookingId: booking.id,
      customerId: booking.customer_id,
      companyName: customer?.company_name ?? "",
      assignmentMeta: readAssignmentMetadata(booking.metadata),
      offerStatuses: (offers ?? []).map((o) => o.status),
    });
  }

  return rows;
}

export async function repairOrphanedBookingWithEngine(
  client: SupabaseClient<Database>,
  bookingId: string,
  backend = createBookingCommandBackend("supabase"),
): Promise<RunAssignmentResult> {
  return runAssignmentAfterPayment(client, backend, bookingId);
}

export type RepairRunOptions = {
  dryRun: boolean;
  /** Injected for tests; defaults to service-role Supabase client. */
  client?: SupabaseClient<Database>;
  /** Injected for tests; defaults to `repairOrphanedBookingWithEngine`. */
  repairBooking?: (
    client: SupabaseClient<Database>,
    bookingId: string,
  ) => Promise<RunAssignmentResult>;
};

export async function runRepairOrphanedAssignments(
  options: RepairRunOptions,
): Promise<number> {
  const client = options.client ?? createServiceRoleClient();
  if (!client) {
    console.error(
      "Missing SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).",
    );
    return 1;
  }

  process.env.BOOKING_COMMAND_BACKEND =
    process.env.BOOKING_COMMAND_BACKEND ?? "supabase";

  const candidates = await findOrphanedE2eAssignmentBookings(client);

  console.log(
    `Found ${candidates.length} orphaned E2E pending_assignment booking(s) (no open offers).\n`,
  );

  if (candidates.length === 0) {
    console.log("Nothing to repair.");
    return 0;
  }

  for (const row of candidates) {
    console.log(`— booking ${row.bookingId}`);
    console.log(`  customer: ${row.companyName} (${row.customerId})`);
    console.log(`  assignment metadata: ${JSON.stringify(row.assignmentMeta)}`);
    console.log(
      `  existing offer statuses: ${
        row.offerStatuses.length > 0 ? row.offerStatuses.join(", ") : "(none)"
      }`,
    );
  }

  if (options.dryRun) {
    console.log(
      "\nDry-run only — no assignment engine calls, no metadata or offer writes.",
    );
    console.log(
      "To apply: CONFIRM_ASSIGNMENT_REPAIR=yes npm run e2e:repair:assignments",
    );
    return 0;
  }

  const repairBooking = options.repairBooking ?? repairOrphanedBookingWithEngine;
  let success = 0;
  let failed = 0;

  for (const row of candidates) {
    console.log(`\nRepairing ${row.bookingId} via runAssignmentAfterPayment…`);
    const result = await repairBooking(client, row.bookingId);

    if (result.ok) {
      console.log(
        `  → outcome=${result.outcome} cleanerId=${result.cleanerId ?? "—"} offerId=${result.offerId ?? "—"}`,
      );
      success += 1;
    } else {
      console.log(`  → FAILED code=${result.code} message=${result.message}`);
      failed += 1;
    }
  }

  console.log(`\nRepair complete. success=${success} failed=${failed}`);
  return failed > 0 ? 1 : 0;
}
