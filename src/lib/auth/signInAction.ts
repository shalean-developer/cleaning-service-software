"use server";

import { redirect } from "next/navigation";
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
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectedFromRaw = String(formData.get("redirectedFrom") ?? "").trim();
  const redirectedFrom = redirectedFromRaw || undefined;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      error:
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message };
  }

  const user = data.user;
  if (!user) {
    return { error: "Sign-in succeeded but no user was returned." };
  }

  const profileResult = await loadProfileRoleForUser(supabase, user.id);
  if (!profileResult.ok) {
    await supabase.auth.signOut();
    return { error: profileResult.error };
  }

  redirect(resolvePostSignInPath(profileResult.role, redirectedFrom));
}
