"use server";

import {
  buildPasswordResetRedirectUrl,
  isPasswordResetEmail,
  PASSWORD_RESET_REQUEST_SUCCESS_MESSAGE,
} from "@/lib/auth/passwordReset";
import { getServerAppBaseUrl } from "@/lib/app/appBaseUrl";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RequestPasswordResetActionState =
  | { error: string }
  | { success: true; message: string }
  | null;

export async function requestPasswordResetAction(
  _previousState: RequestPasswordResetActionState,
  formData: FormData,
): Promise<RequestPasswordResetActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Email address is required." };
  }

  if (!isPasswordResetEmail(email)) {
    return { error: "Enter a valid email address." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      error:
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    };
  }

  const origin = getServerAppBaseUrl() ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: buildPasswordResetRedirectUrl(origin),
  });

  // Always return the same success message for valid emails (do not reveal account existence).
  return {
    success: true,
    message: PASSWORD_RESET_REQUEST_SUCCESS_MESSAGE,
  };
}
