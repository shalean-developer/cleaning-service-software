"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { updatePasswordAction, type UpdatePasswordActionState } from "@/lib/auth/updatePasswordAction";
import { SIGN_IN_PATH } from "@/lib/auth/redirects";
import { CUSTOMER_SIGNUP_MIN_PASSWORD_LENGTH } from "@/lib/auth/customerSignup";
import {
  UI_AUTH_BUTTON_PRIMARY_CLASS,
  UI_AUTH_INPUT_CLASS,
  UI_AUTH_LABEL_CLASS,
} from "@/lib/ui/productUiTokens";

function UpdatePasswordButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={UI_AUTH_BUTTON_PRIMARY_CLASS}>
      {pending ? "Saving…" : "Save new password"}
    </button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<UpdatePasswordActionState, FormData>(
    updatePasswordAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className={UI_AUTH_LABEL_CLASS}>New password</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={CUSTOMER_SIGNUP_MIN_PASSWORD_LENGTH}
          className={UI_AUTH_INPUT_CLASS}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={UI_AUTH_LABEL_CLASS}>Confirm password</span>
        <input
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={CUSTOMER_SIGNUP_MIN_PASSWORD_LENGTH}
          className={UI_AUTH_INPUT_CLASS}
        />
      </label>

      {state?.error ? (
        <p
          className="rounded-xl border border-red-200/80 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <UpdatePasswordButton />

      <p className="text-center text-sm text-zinc-600">
        <Link
          href={SIGN_IN_PATH}
          className="font-medium text-zinc-900 underline-offset-2 transition-colors hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
