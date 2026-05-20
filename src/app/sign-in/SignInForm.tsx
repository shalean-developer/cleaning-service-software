"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInAction, type SignInActionState } from "@/lib/auth/signInAction";
import {
  UI_AUTH_BUTTON_PRIMARY_CLASS,
  UI_AUTH_INPUT_CLASS,
  UI_AUTH_LABEL_CLASS,
} from "@/lib/ui/productUiTokens";

type Props = {
  redirectedFrom: string | null;
  onForgotPassword: () => void;
};

function SignInSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={UI_AUTH_BUTTON_PRIMARY_CLASS}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function SignInForm({ redirectedFrom, onForgotPassword }: Props) {
  const [state, formAction] = useActionState<SignInActionState, FormData>(
    signInAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {redirectedFrom ? (
        <input type="hidden" name="redirectedFrom" value={redirectedFrom} />
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className={UI_AUTH_LABEL_CLASS}>Email or mobile number</span>
        <input
          type="text"
          name="email"
          autoComplete="username"
          inputMode="text"
          required
          className={UI_AUTH_INPUT_CLASS}
        />
        <span className="text-xs leading-snug text-zinc-500">
          Cleaners can sign in with a mobile number or their @shalean.co.za email.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between gap-3">
          <span className={UI_AUTH_LABEL_CLASS}>Password</span>
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-xs font-medium text-zinc-500 underline-offset-2 transition-colors hover:text-zinc-800 hover:underline"
          >
            Forgot password?
          </button>
        </span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
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

      <SignInSubmitButton />
    </form>
  );
}
