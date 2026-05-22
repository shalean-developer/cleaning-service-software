import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isCustomerSignupEnabled } from "@/lib/auth/customerSignupFlag";
import { buildAuthPathWithRedirect } from "@/lib/auth/bookingAuthPaths";
import { SIGN_IN_PATH } from "@/lib/auth/redirects";

export const metadata: Metadata = {
  title: "Check your email",
  description: "Confirm your email to finish creating your account",
};

type PageProps = {
  searchParams: Promise<{ email?: string; redirectedFrom?: string }>;
};

export default async function SignUpCheckEmailPage({ searchParams }: PageProps) {
  if (!isCustomerSignupEnabled()) {
    redirect(SIGN_IN_PATH);
  }

  const { email, redirectedFrom } = await searchParams;
  const trimmedEmail = email?.trim();
  const signInHref = buildAuthPathWithRedirect(SIGN_IN_PATH, redirectedFrom);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-16">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Check your email</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {trimmedEmail ? (
            <>
              We sent a confirmation link to <span className="font-medium text-zinc-800">{trimmedEmail}</span>.
              Open it to finish setting up your account, then sign in.
            </>
          ) : (
            <>
              We sent a confirmation link to your email address. Open it to finish setting up your
              account, then sign in.
            </>
          )}
        </p>
      </section>
      <p className="text-center text-sm text-zinc-600">
        <Link
          href={signInHref}
          className="font-medium text-zinc-900 underline-offset-2 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
