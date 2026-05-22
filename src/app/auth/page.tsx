import type { Metadata } from "next";
import Link from "next/link";
import { ShaleanLogo } from "@/components/marketing/ShaleanLogo";
import {
  AUTH_PATH,
  CAREERS_PATH,
  CLEANER_LOGIN_ENTRY_PATH,
  CUSTOMER_LOGIN_ENTRY_PATH,
  SIGNUP_ENTRY_PATH,
} from "@/lib/auth/authEntryPaths";
import { UI_BUTTON_PRIMARY_CLASS } from "@/lib/ui/productUiTokens";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Choose how you want to sign in to Shalean. customer or cleaner.",
};

const customerButtonClass =
  "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-shalean-primary px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(37,99,235,0.25)] transition-colors hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shalean-primary focus-visible:ring-offset-2";

const cleanerButtonClass = `${UI_BUTTON_PRIMARY_CLASS} w-full`;

const secondaryLinkClass =
  "text-sm font-medium text-zinc-600 underline-offset-2 transition-colors hover:text-zinc-900 hover:underline";

const policyLinkClass =
  "font-medium text-zinc-700 underline-offset-2 transition-colors hover:text-zinc-900 hover:underline";

export default function AuthRoleChooserPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-zinc-200/90">
        <div className="mx-auto flex h-[3.75rem] w-full max-w-6xl items-center px-4 sm:px-6">
          <ShaleanLogo />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-[34rem] space-y-8">
          <div className="space-y-2 text-center sm:text-left">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[1.75rem]">
              What would you like to do?
            </h1>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Link href={CUSTOMER_LOGIN_ENTRY_PATH} className={customerButtonClass}>
                Sign in as Customer
              </Link>
              <p className="text-center text-sm text-zinc-600">
                Need an account?{" "}
                <Link href={SIGNUP_ENTRY_PATH} className={secondaryLinkClass}>
                  Create one
                </Link>
              </p>
            </div>

            <div className="flex items-center gap-3" role="separator" aria-label="or">
              <span className="h-px flex-1 bg-zinc-200" aria-hidden />
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">or</span>
              <span className="h-px flex-1 bg-zinc-200" aria-hidden />
            </div>

            <div className="space-y-2">
              <Link href={CLEANER_LOGIN_ENTRY_PATH} className={cleanerButtonClass}>
                Sign in as Cleaner
              </Link>
              <p className="text-center text-sm text-zinc-600">
                <Link href={CAREERS_PATH} className={secondaryLinkClass}>
                  Apply to become a cleaner
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center text-xs leading-relaxed text-zinc-500 sm:text-left">
            By continuing, you agree to Shalean&apos;s{" "}
            <Link href="/terms" className={policyLinkClass}>
              Terms
            </Link>
            ,{" "}
            <Link href="/privacy" className={policyLinkClass}>
              Privacy Policy
            </Link>
            , and{" "}
            <Link href="/refund-policy" className={policyLinkClass}>
              Refund Policy
            </Link>
            .
          </p>
        </div>
      </main>

      <footer className="px-4 pb-6 pt-2 sm:px-6 sm:pb-8">
        <p className="text-center text-xs text-zinc-500 sm:text-right">
          © 2026 Shalean Cleaning Services. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
