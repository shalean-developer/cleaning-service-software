import type { Metadata } from "next";
import Link from "next/link";
import { SIGN_IN_PATH } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Choose a new password for your Shalean account",
};

type PageProps = {
  searchParams: Promise<{ code?: string; error?: string; error_description?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { code, error, error_description: errorDescription } = await searchParams;
  const linkError = error
    ? errorDescription?.trim() || "This password reset link is invalid or has expired."
    : null;

  if (code && !linkError) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        return (
          <ResetPasswordShell>
            <p
              className="rounded-xl border border-red-200/80 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
              role="alert"
            >
              {exchangeError.message}
            </p>
            <BackToSignInLink />
          </ResetPasswordShell>
        );
      }
    }
  }

  return (
    <ResetPasswordShell>
      {linkError ? (
        <p
          className="rounded-xl border border-red-200/80 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
          role="alert"
        >
          {linkError}
        </p>
      ) : (
        <>
          <p className="text-sm leading-6 text-zinc-600">Enter a new password for your account.</p>
          <ResetPasswordForm />
        </>
      )}
      {!linkError ? null : <BackToSignInLink />}
    </ResetPasswordShell>
  );
}

function ResetPasswordShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 bg-white px-4 py-16">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Reset your password</h1>
      </section>
      {children}
    </main>
  );
}

function BackToSignInLink() {
  return (
    <p className="text-center text-sm text-zinc-600">
      <Link
        href={SIGN_IN_PATH}
        className="font-medium text-zinc-900 underline-offset-2 transition-colors hover:underline"
      >
        Back to sign in
      </Link>
    </p>
  );
}
