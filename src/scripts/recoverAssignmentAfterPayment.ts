import type { SupabaseClient } from "@supabase/supabase-js";
import { runAssignmentRecoveryBatch } from "@/features/assignments/server/runAssignmentRecovery";
import { findAssignmentRecoveryCandidates } from "@/features/assignments/server/findAssignmentRecoveryCandidates";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import type { Database } from "@/lib/database/types";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export type RecoverAssignmentCliOptions = {
  dryRun: boolean;
  client?: SupabaseClient<Database>;
};

export async function runRecoverAssignmentAfterPaymentCli(
  options: RecoverAssignmentCliOptions,
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

  const candidates = await findAssignmentRecoveryCandidates(client);

  console.log(
    `Found ${candidates.length} paid confirmed booking(s) needing assignment recovery.\n`,
  );

  for (const row of candidates) {
    console.log(`- booking ${row.bookingId}`);
    console.log(`  customer: ${row.customerId}`);
    console.log(`  payment: ${row.paymentId} (paid ${row.paidAt})`);
  }

  if (candidates.length === 0) {
    console.log("Nothing to recover.");
    return 0;
  }

  if (options.dryRun) {
    console.log(
      "\nDry-run only. no runAssignmentAfterPayment calls.",
    );
    console.log(
      "To apply: CONFIRM_ASSIGNMENT_RECOVERY=yes npm run ops:recover:assignments",
    );
    console.log(
      "Or POST /api/cron/recover-assignment-after-payment with CRON_SECRET.",
    );
    return 0;
  }

  const backend = createBookingCommandBackend("supabase");
  const result = await runAssignmentRecoveryBatch(client, backend);

  console.log(
    `\nRecovery complete. attempted=${result.attemptedCount} recovered=${result.recoveredBookingIds.length} failed=${result.failed.length} skipped=${result.skippedBookingIds.length}`,
  );

  for (const id of result.recoveredBookingIds) {
    console.log(`  recovered: ${id}`);
  }
  for (const f of result.failed) {
    console.log(`  failed: ${f.bookingId} (${f.code}) ${f.message}`);
  }

  return result.failed.length > 0 ? 1 : 0;
}
