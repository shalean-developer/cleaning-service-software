"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  requestPasswordResetAction,
  type RequestPasswordResetActionState,
} from "@/lib/auth/requestPasswordResetAction";
import {
  UI_AUTH_BUTTON_PRIMARY_CLASS,
  UI_AUTH_INPUT_CLASS,
  UI_AUTH_LABEL_CLASS,
} from "@/lib/ui/productUiTokens";

type Props = {
  onBackToSignIn: () => void;
};

function SendResetLinkButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={UI_AUTH_BUTTON_PRIMARY_CLASS}>
      {pending ? "Sending…" : "Send reset link"}
    </button>
  );
}

export function ResetPasswordRequestForm({ onBackToSignIn }: Props) {
  const [state, formAction] = useActionState<RequestPasswordResetActionState, FormData>(
    requestPasswordResetAction,
    null,
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={UI_AUTH_LABEL_CLASS}>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            className={UI_AUTH_INPUT_CLASS}
          />
        </label>

        {state && "error" in state ? (
          <p
            className="rounded-xl border border-red-200/80 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}

        {state && "success" in state ? (
          <p
            className="rounded-xl border border-emerald-200/80 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900"
            role="status"
          >
            {state.message}
          </p>
        ) : null}

        <SendResetLinkButton />
      </form>

      <p className="text-center text-sm text-zinc-600">
        <button
          type="button"
          onClick={onBackToSignIn}
          className="font-medium text-zinc-900 underline-offset-2 transition-colors hover:underline"
        >
          Back to sign in
        </button>
      </p>
    </div>
  );
}
