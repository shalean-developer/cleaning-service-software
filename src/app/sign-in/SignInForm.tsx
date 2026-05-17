"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInAction, type SignInActionState } from "@/lib/auth/signInAction";

type Props = {
  redirectedFrom: string | null;
};

function SignInSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function SignInForm({ redirectedFrom }: Props) {
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
        <span className="text-sm font-medium text-zinc-800">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
        />
      </label>
      {state?.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      <SignInSubmitButton />
    </form>
  );
}
