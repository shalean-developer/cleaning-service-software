"use client";

import { useState } from "react";
import Link from "next/link";
import { SIGN_UP_PATH } from "@/lib/auth/customerSignup";
import {
  isCleanerSignInIntent,
  resolveSignInPageCopy,
} from "@/lib/auth/signInIntent";
import { ResetPasswordRequestForm } from "./ResetPasswordRequestForm";
import { SignInForm } from "./SignInForm";

type Props = {
  redirectedFrom: string | null;
  signupEnabled: boolean;
};

export function SignInPageContent({ redirectedFrom, signupEnabled }: Props) {
  const [mode, setMode] = useState<"sign-in" | "reset">("sign-in");
  const copy = resolveSignInPageCopy(redirectedFrom);
  const cleanerIntent = isCleanerSignInIntent(redirectedFrom);
  const showCustomerSignup = signupEnabled && !cleanerIntent;

  return (
    <>
      <section>
        {mode === "sign-in" ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{copy.title}</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{copy.subtitle}</p>
            {copy.helperText ? (
              <p className="mt-2 text-sm leading-6 text-zinc-500">{copy.helperText}</p>
            ) : null}
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Reset your password
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Enter your email address and we&apos;ll send you a password reset link.
            </p>
          </>
        )}
      </section>

      {mode === "sign-in" ? (
        <SignInForm
          redirectedFrom={redirectedFrom}
          onForgotPassword={() => setMode("reset")}
        />
      ) : (
        <ResetPasswordRequestForm onBackToSignIn={() => setMode("sign-in")} />
      )}

      {mode === "sign-in" && showCustomerSignup ? (
        <p className="text-center text-sm text-zinc-600">
          Don&apos;t have an account?{" "}
          <Link
            href={SIGN_UP_PATH}
            className="font-medium text-zinc-900 underline-offset-2 transition-colors hover:underline"
          >
            Create one
          </Link>
        </p>
      ) : null}

      {mode === "sign-in" && cleanerIntent ? (
        <p className="text-center text-sm text-zinc-600">
          Looking to book a clean?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-zinc-900 underline-offset-2 transition-colors hover:underline"
          >
            Customer sign in
          </Link>
        </p>
      ) : null}

      {mode === "sign-in" ? (
        <p className="text-center text-sm text-zinc-600">
          <Link
            href="/"
            className="font-medium text-zinc-900 underline-offset-2 transition-colors hover:underline"
          >
            Back to home
          </Link>
        </p>
      ) : null}
    </>
  );
}
