"use server";

import { redirect } from "next/navigation";
import { CUSTOMER_SIGNUP_MIN_PASSWORD_LENGTH } from "@/lib/auth/customerSignup";
import { SIGN_IN_PATH } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UpdatePasswordActionState = {
  error: string;
} | null;

export async function updatePasswordAction(
  _previousState: UpdatePasswordActionState,
  formData: FormData,
): Promise<UpdatePasswordActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password || !confirmPassword) {
    return { error: "Password and confirmation are required." };
  }

  if (password.length < CUSTOMER_SIGNUP_MIN_PASSWORD_LENGTH) {
    return {
      error: `Password must be at least ${CUSTOMER_SIGNUP_MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      error:
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: "Your reset link is invalid or has expired. Request a new link from the sign-in page.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  await supabase.auth.signOut();
  redirect(`${SIGN_IN_PATH}?passwordReset=success`);
}
