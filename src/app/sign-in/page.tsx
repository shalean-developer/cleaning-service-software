import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Cleaning Services account",
};

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-16">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Use your email and password. E2E test accounts are documented in{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
            docs/testing/live-e2e-smoke-test.md
          </code>
          .
        </p>
      </section>
      <Suspense fallback={<p className="text-sm text-zinc-600">Loading…</p>}>
        <SignInForm />
      </Suspense>
      <p className="text-center text-sm text-zinc-600">
        <Link href="/" className="font-medium text-zinc-900 underline-offset-2 hover:underline">
          Back to home
        </Link>
      </p>
    </main>
  );
}
