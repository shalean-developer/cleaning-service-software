import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { isCustomerSignupEnabled } from "@/lib/auth/customerSignupFlag";
import { resolvePostSignInPath } from "@/lib/auth/redirects";
import { SignInPageContent } from "./SignInPageContent";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Shalean account",
};

type PageProps = {
  searchParams: Promise<{ redirectedFrom?: string; passwordReset?: string }>;
};

export default async function SignInPage({ searchParams }: PageProps) {
  const { redirectedFrom, passwordReset } = await searchParams;
  const user = await getCurrentUser();
  if (user) {
    redirect(resolvePostSignInPath(user.role, redirectedFrom));
  }

  const signupEnabled = isCustomerSignupEnabled();
  const showPasswordResetSuccess = passwordReset === "success";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 bg-white px-4 py-16">
      {showPasswordResetSuccess ? (
        <p
          className="rounded-xl border border-emerald-200/80 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900"
          role="status"
        >
          Your password was updated. Sign in with your new password.
        </p>
      ) : null}

      <SignInPageContent
        redirectedFrom={redirectedFrom ?? null}
        signupEnabled={signupEnabled}
      />
    </main>
  );
}
