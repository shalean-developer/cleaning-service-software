import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { SIGN_UP_PATH } from "@/lib/auth/customerSignup";
import { isCustomerSignupEnabled } from "@/lib/auth/customerSignupFlag";
import { resolvePostSignInPath } from "@/lib/auth/redirects";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Cleaning Services account",
};

type PageProps = {
  searchParams: Promise<{ redirectedFrom?: string }>;
};

export default async function SignInPage({ searchParams }: PageProps) {
  const { redirectedFrom } = await searchParams;
  const user = await getCurrentUser();
  if (user) {
    redirect(resolvePostSignInPath(user.role, redirectedFrom));
  }

  const signupEnabled = isCustomerSignupEnabled();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-16">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Use your email or mobile number and password. E2E test accounts are documented in{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
            docs/testing/live-e2e-smoke-test.md
          </code>
          .
        </p>
      </section>
      <SignInForm redirectedFrom={redirectedFrom ?? null} />
      {signupEnabled ? (
        <p className="text-center text-sm text-zinc-600">
          Don&apos;t have an account?{" "}
          <Link
            href={SIGN_UP_PATH}
            className="font-medium text-zinc-900 underline-offset-2 hover:underline"
          >
            Create one
          </Link>
        </p>
      ) : null}
      <p className="text-center text-sm text-zinc-600">
        <Link href="/" className="font-medium text-zinc-900 underline-offset-2 hover:underline">
          Back to home
        </Link>
      </p>
    </main>
  );
}
