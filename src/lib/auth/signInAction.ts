"use server";

import { redirect } from "next/navigation";
import { resolveSignInEmail } from "@/lib/auth/cleanerAuthIdentity";
import { loadProfileRoleForUser } from "@/lib/auth/loadProfileRole";
import { resolvePostSignInPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInActionState = {
  error: string;
} | null;

export async function signInAction(
  _previousState: SignInActionState,
  formData: FormData,
): Promise<SignInActionState> {
  const identifier = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectedFromRaw = String(formData.get("redirectedFrom") ?? "").trim();
  const redirectedFrom = redirectedFromRaw || undefined;

  if (!identifier || !password) {
    return { error: "Email or mobile number and password are required." };
  }

  const resolvedEmail = resolveSignInEmail(identifier);
  if (!resolvedEmail.ok) {
    return { error: resolvedEmail.error };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      error:
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: resolvedEmail.email,
    password,
  });
  if (error) {
    return { error: error.message };
  }

  const user = data.user;
  if (!user) {
    return { error: "Sign-in succeeded but no user was returned." };
  }

  // Attach the new session JWT before the RLS-scoped profiles read.
  const { error: sessionError } = await supabase.auth.getUser();
  if (sessionError) {
    await supabase.auth.signOut();
    return { error: sessionError.message };
  }

  const profileResult = await loadProfileRoleForUser(supabase, user.id);
  if (!profileResult.ok) {
    await supabase.auth.signOut();
    return { error: profileResult.error };
  }

  redirect(resolvePostSignInPath(profileResult.role, redirectedFrom));
}
