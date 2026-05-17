import { E2E_LABELS, E2E_PASSWORD } from "./constants.mjs";

/**
 * Find or create an auth user + profile for E2E smoke tests.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ email: string, role: string, fullName: string, profileIdHint?: string }} params
 */
export async function ensureE2eUser(client, { email, role, fullName, profileIdHint }) {
  let userId = profileIdHint?.trim() || null;

  if (userId) {
    const { data: existingById, error: getErr } = await client.auth.admin.getUserById(userId);
    if (getErr) throw getErr;
    if (!existingById.user) userId = null;
  }

  if (!userId) {
    let page = 1;
    for (;;) {
      const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const match = (data.users ?? []).find((u) => u.email === email);
      if (match) {
        userId = match.id;
        break;
      }
      if ((data.users ?? []).length < 200) break;
      page += 1;
    }
  }

  if (!userId) {
    const { data, error } = await client.auth.admin.createUser({
      email,
      password: E2E_PASSWORD,
      email_confirm: true,
      user_metadata: { role, full_name: fullName, e2e_seed: true },
    });
    if (error) throw error;
    userId = data.user?.id ?? null;
  } else {
    await client.auth.admin.updateUserById(userId, {
      email,
      password: E2E_PASSWORD,
      email_confirm: true,
      user_metadata: { role, full_name: fullName, e2e_seed: true },
    });
  }

  if (!userId) throw new Error(`Could not create auth user for ${email}`);

  const { error: profileErr } = await client.from("profiles").upsert(
    { id: userId, role, full_name: fullName },
    { onConflict: "id" },
  );
  if (profileErr) throw profileErr;

  return userId;
}

export async function ensureE2eCustomer(client, profileId) {
  const { data: existing } = await client
    .from("customers")
    .select("id, profile_id, company_name")
    .eq("company_name", E2E_LABELS.customerCompany)
    .maybeSingle();

  if (existing) return existing;

  const { data: byProfile } = await client
    .from("customers")
    .select("id, profile_id, company_name")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (byProfile) {
    if (byProfile.company_name !== E2E_LABELS.customerCompany) {
      await client
        .from("customers")
        .update({ company_name: E2E_LABELS.customerCompany })
        .eq("id", byProfile.id);
    }
    return { ...byProfile, company_name: E2E_LABELS.customerCompany };
  }

  const { data: created, error } = await client
    .from("customers")
    .insert({
      profile_id: profileId,
      company_name: E2E_LABELS.customerCompany,
      phone: `${E2E_LABELS.customerCompany}_phone`,
    })
    .select("id, profile_id, company_name")
    .single();
  if (error) throw error;
  return created;
}

export async function ensureE2eCleaner(client, profileId) {
  const { data: byProfile } = await client
    .from("cleaners")
    .select("id, profile_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (byProfile) return byProfile;

  const { data: created, error } = await client
    .from("cleaners")
    .insert({
      profile_id: profileId,
      phone: E2E_LABELS.cleanerPhone,
      active: true,
    })
    .select("id, profile_id")
    .single();
  if (error) throw error;
  return created;
}
