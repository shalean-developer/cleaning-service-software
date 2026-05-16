#!/usr/bin/env node
/**
 * List assignment offers for a booking or E2E cleaner.
 * Usage:
 *   npm run e2e:inspect:offers -- --booking <bookingId>
 *   npm run e2e:inspect:offers -- --cleaner
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, requireServiceRoleClient } from "./lib/env.mjs";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

function parseArgs() {
  const args = process.argv.slice(2);
  if (args[0] === "--booking" && args[1]) return { mode: "booking", id: args[1] };
  if (args.includes("--cleaner")) {
    const id = process.env.E2E_TEST_CLEANER_ID;
    if (!id) throw new Error("E2E_TEST_CLEANER_ID not set. Run npm run e2e:seed first.");
    return { mode: "cleaner", id };
  }
  throw new Error("Usage: inspect-offers --booking <id> | --cleaner");
}

async function main() {
  const { mode, id } = parseArgs();
  let query = client.from("assignment_offers").select("*").order("offered_at", { ascending: false });
  if (mode === "booking") query = query.eq("booking_id", id);
  else query = query.eq("cleaner_id", id);

  const { data, error } = await query.limit(50);
  if (error) throw error;
  console.log(JSON.stringify({ mode, filterId: id, offers: data ?? [] }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
