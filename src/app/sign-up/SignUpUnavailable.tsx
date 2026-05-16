import Link from "next/link";
import { SIGN_IN_PATH } from "@/lib/auth/redirects";

export function SignUpUnavailable() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-16">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Signup is not available yet
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          New customer accounts are not open right now. If you already have an account, sign in
          below.
        </p>
      </section>
      <p className="text-center text-sm text-zinc-600">
        <Link
          href={SIGN_IN_PATH}
          className="font-medium text-zinc-900 underline-offset-2 hover:underline"
        >
          Go to sign in
        </Link>
      </p>
    </main>
  );
}
