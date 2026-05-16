"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGN_IN_PATH } from "./redirects";

/** Clears the Supabase session and redirects to sign-in. */
export async function signOut(): Promise<never> {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect(SIGN_IN_PATH);
}
