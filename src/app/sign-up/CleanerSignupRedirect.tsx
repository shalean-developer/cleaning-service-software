import Link from "next/link";
import { CLEANER_SIGN_IN_PATH } from "@/features/marketing/constants";

/** Shown when a cleaner applicant lands on customer sign-up by mistake. */
export function CleanerSignupRedirect() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-16">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Cleaner accounts are provisioned by Shalean
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Customer sign-up is for booking cleaning services. If you are joining as a cleaner,
          sign in with the credentials you received after onboarding — or contact us to start
          your application.
        </p>
      </section>
      <p className="text-sm text-zinc-600">
        <Link
          href={CLEANER_SIGN_IN_PATH}
          className="font-medium text-zinc-900 underline-offset-2 hover:underline"
        >
          Go to cleaner sign in
        </Link>
      </p>
      <p className="text-center text-sm text-zinc-600">
        Looking to book?{" "}
        <Link href="/sign-up" className="font-medium text-zinc-900 underline-offset-2 hover:underline">
          Create a customer account
        </Link>
      </p>
    </main>
  );
}
