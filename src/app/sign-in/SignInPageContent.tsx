"use client";

import { useState } from "react";
import Link from "next/link";
import { SIGN_UP_PATH } from "@/lib/auth/customerSignup";
import { ResetPasswordRequestForm } from "./ResetPasswordRequestForm";
import { SignInForm } from "./SignInForm";

type Props = {
  redirectedFrom: string | null;
  signupEnabled: boolean;
};

export function SignInPageContent({ redirectedFrom, signupEnabled }: Props) {
  const [mode, setMode] = useState<"sign-in" | "reset">("sign-in");

  return (
    <>
      <section>
        {mode === "sign-in" ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Sign in</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Sign in to manage your bookings, payments, and cleaner assignments.
            </p>
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

      {mode === "sign-in" && signupEnabled ? (
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
