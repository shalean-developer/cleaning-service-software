import { classifyMockCleaner, isTestCustomerCompanyName } from "./mock-cleaner-patterns.mjs";

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function listAuthEmailsByProfileId(client) {
  /** @type {Map<string, string>} */
  const byId = new Map();
  let page = 1;
  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data.users ?? [];
    for (const user of users) {
      if (user.id && user.email) byId.set(user.id, user.email);
    }
    if (users.length < 200) break;
    page += 1;
  }
  return byId;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {Map<string, { mock: boolean }>} [profileClassById]
 */
export async function loadCleanerCandidates(client, profileClassById = new Map()) {
  const { data: profiles, error: profileErr } = await client
    .from("profiles")
    .select("id, role, full_name")
    .eq("role", "cleaner");
  if (profileErr) throw profileErr;

  const { data: cleaners, error: cleanerErr } = await client
    .from("cleaners")
    .select("id, profile_id, phone, deleted_at, lifecycle_reason");
  if (cleanerErr) throw cleanerErr;

  const authEmails = await listAuthEmailsByProfileId(client);
  const cleanerByProfile = new Map((cleaners ?? []).map((c) => [c.profile_id, c]));

  const rows = [];
  for (const profile of profiles ?? []) {
    const cleaner = cleanerByProfile.get(profile.id);
    if (!cleaner) continue;
    const email = authEmails.get(profile.id) ?? null;
    const linkedProfile = profileClassById.get(profile.id);
    const classification = classifyMockCleaner({
      email,
      fullName: profile.full_name,
      phone: cleaner.phone,
      linkedProfileMock: linkedProfile?.mock === true,
    });
    rows.push({
      email: email ?? "(no auth email)",
      profileId: profile.id,
      cleanerId: cleaner.id,
      fullName: profile.full_name,
      phone: cleaner.phone,
      deletedAt: cleaner.deleted_at,
      lifecycleReason: cleaner.lifecycle_reason,
      classification,
    });
  }
  return rows;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} cleanerId
 */
export async function countCleanerRelatedRows(client, cleanerId) {
  const countEq = async (table, column = "cleaner_id") => {
    const { count, error } = await client
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(column, cleanerId);
    if (error) throw error;
    return count ?? 0;
  };

  const { count: bookingsAssigned, error: bookingErr } = await client
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("cleaner_id", cleanerId);
  if (bookingErr) throw bookingErr;

  return {
    cleaner_availability: await countEq("cleaner_availability"),
    cleaner_service_capabilities: await countEq("cleaner_service_capabilities"),
    cleaner_service_areas: await countEq("cleaner_service_areas"),
    cleaner_time_off: await countEq("cleaner_time_off"),
    assignment_offers: await countEq("assignment_offers"),
    earning_lines: await countEq("earning_lines"),
    booking_cleaners: await countEq("booking_cleaners"),
    bookings_assigned: bookingsAssigned ?? 0,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} cleanerId
 */
export async function summarizeBookingsForCleaner(client, cleanerId) {
  const { data: assigned, error: assignedErr } = await client
    .from("bookings")
    .select("id, customer_id, status")
    .eq("cleaner_id", cleanerId);
  if (assignedErr) throw assignedErr;

  const bookingIds = new Set((assigned ?? []).map((b) => b.id));

  const { data: rosterRows, error: rosterErr } = await client
    .from("booking_cleaners")
    .select("booking_id")
    .eq("cleaner_id", cleanerId);
  if (rosterErr) throw rosterErr;
  for (const row of rosterRows ?? []) {
    if (row.booking_id) bookingIds.add(row.booking_id);
  }

  const ids = [...bookingIds];
  if (ids.length === 0) {
    return { total: 0, testCustomer: 0, realCustomer: 0, paidRealCustomer: 0 };
  }

  const { data: bookings, error: bookingErr } = await client
    .from("bookings")
    .select("id, customer_id, status")
    .in("id", ids);
  if (bookingErr) throw bookingErr;

  const customerIds = [...new Set((bookings ?? []).map((b) => b.customer_id))];
  const { data: customers, error: custErr } = await client
    .from("customers")
    .select("id, company_name")
    .in("id", customerIds);
  if (custErr) throw custErr;

  const companyByCustomer = new Map((customers ?? []).map((c) => [c.id, c.company_name]));

  const { data: payments, error: payErr } = await client
    .from("payments")
    .select("booking_id, status")
    .in("booking_id", ids);
  if (payErr) throw payErr;

  const paidBookingIds = new Set(
    (payments ?? []).filter((p) => p.status === "paid").map((p) => p.booking_id),
  );

  let testCustomer = 0;
  let realCustomer = 0;
  let paidRealCustomer = 0;

  for (const booking of bookings ?? []) {
    const company = companyByCustomer.get(booking.customer_id) ?? "";
    if (isTestCustomerCompanyName(company)) {
      testCustomer += 1;
    } else {
      realCustomer += 1;
      if (paidBookingIds.has(booking.id)) paidRealCustomer += 1;
    }
  }

  return {
    total: bookings?.length ?? 0,
    testCustomer,
    realCustomer,
    paidRealCustomer,
  };
}

/**
 * @param {Record<string, number>} related
 */
export function formatRelatedSummary(related, bookingSummary) {
  const parts = [
    `avail=${related.cleaner_availability}`,
    `caps=${related.cleaner_service_capabilities}`,
    `areas=${related.cleaner_service_areas}`,
    `time_off=${related.cleaner_time_off}`,
    `offers=${related.assignment_offers}`,
    `earnings=${related.earning_lines}`,
    `roster=${related.booking_cleaners}`,
    `bookings=${related.bookings_assigned}`,
  ];
  if (bookingSummary) {
    parts.push(
      `booking_links=${bookingSummary.total}(test=${bookingSummary.testCustomer},real=${bookingSummary.realCustomer},paid_real=${bookingSummary.paidRealCustomer})`,
    );
  }
  return parts.join(" ");
}
