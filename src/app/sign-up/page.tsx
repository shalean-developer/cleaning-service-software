import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { isCustomerSignupEnabled } from "@/lib/auth/customerSignupFlag";
import { SignUpForm } from "./SignUpForm";
import { SignUpUnavailable } from "./SignUpUnavailable";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Shalean customer account",
};

export default function SignUpPage() {
  if (!isCustomerSignupEnabled()) {
    return <SignUpUnavailable />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-16">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Create account</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Sign up as a customer to book cleaning services with Shalean.
        </p>
      </section>
      <Suspense fallback={<p className="text-sm text-zinc-600">Loading…</p>}>
        <SignUpForm />
      </Suspense>
      <p className="text-center text-sm text-zinc-600">
        <Link href="/" className="font-medium text-zinc-900 underline-offset-2 hover:underline">
          Back to home
        </Link>
      </p>
    </main>
  );
}
