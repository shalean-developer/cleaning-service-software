"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MARKETING_NAV_PATHS } from "@/features/marketing/constants";
import { signInAction, type SignInActionState } from "@/lib/auth/signInAction";
import {
  UI_AUTH_BUTTON_PRIMARY_CLASS,
  UI_AUTH_INPUT_CLASS,
  UI_AUTH_LABEL_CLASS,
} from "@/lib/ui/productUiTokens";

type Props = {
  redirectedFrom: string | null;
  cleanerIntent?: boolean;
  onForgotPassword: () => void;
};

function IconEye({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3l18 18M10.5 10.5a3 3 0 004.24 4.24M9.88 5.09A10.94 10.94 0 0112 5c6.5 0 10 7 10 7a11.6 11.6 0 01-3.17 3.88M6.23 6.23A11.55 11.55 0 002 12s3.5 7 10 7a10.9 10.9 0 004.11-.78"
      />
    </svg>
  );
}

function SignInSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={UI_AUTH_BUTTON_PRIMARY_CLASS}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function SignInForm({ redirectedFrom, cleanerIntent = false, onForgotPassword }: Props) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction] = useActionState<SignInActionState, FormData>(
    signInAction,
    null,
  );

  useEffect(() => {
    if (state && "redirectTo" in state && state.redirectTo) {
      router.replace(state.redirectTo);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {redirectedFrom ? (
        <input type="hidden" name="redirectedFrom" value={redirectedFrom} />
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className={UI_AUTH_LABEL_CLASS}>
          {cleanerIntent ? "Phone number" : "Email or mobile number"}
        </span>
        <input
          type={cleanerIntent ? "tel" : "text"}
          name="email"
          autoComplete={cleanerIntent ? "tel" : "username"}
          inputMode={cleanerIntent ? "tel" : "text"}
          required
          className={UI_AUTH_INPUT_CLASS}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between gap-3">
          <span className={UI_AUTH_LABEL_CLASS}>Password</span>
          {cleanerIntent ? (
            <Link
              href={MARKETING_NAV_PATHS.contact}
              className="text-xs font-medium text-zinc-500 underline-offset-2 transition-colors hover:text-zinc-800 hover:underline"
            >
              Contact support
            </Link>
          ) : (
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs font-medium text-zinc-500 underline-offset-2 transition-colors hover:text-zinc-800 hover:underline"
            >
              Forgot password?
            </button>
          )}
        </span>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            required
            className={`${UI_AUTH_INPUT_CLASS} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-xl text-zinc-500 transition-colors hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <IconEyeOff className="h-5 w-5" />
            ) : (
              <IconEye className="h-5 w-5" />
            )}
          </button>
        </div>
      </label>

      {state && "error" in state && state.error ? (
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
