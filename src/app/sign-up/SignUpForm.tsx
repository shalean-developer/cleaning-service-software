"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loadProfileRoleForUser } from "@/lib/auth/loadProfileRole";
import {
  buildCustomerSignupEmailRedirectUrl,
  buildCustomerSignupMetadata,
  CUSTOMER_SIGNUP_MIN_PASSWORD_LENGTH,
  resolvePostCustomerSignUpPath,
  SIGN_UP_CHECK_EMAIL_PATH,
} from "@/lib/auth/customerSignup";
import { SIGN_IN_PATH } from "@/lib/auth/redirects";
import { UI_BUTTON_PRIMARY_CLASS } from "@/lib/ui/productUiTokens";
import {
  createSupabaseBrowserClient,
  SupabaseBrowserConfigError,
} from "@/lib/supabase/browser";

/** Static placeholder — avoids hydration mismatch when extensions inject form attributes. */
function SignUpFormSkeleton() {
  return (
    <section className="flex flex-col gap-4" aria-hidden>
      <div className="h-[66px] rounded-lg bg-zinc-100" />
      <div className="h-[66px] rounded-lg bg-zinc-100" />
      <div className="h-[66px] rounded-lg bg-zinc-100" />
      <div className="h-10 rounded-xl bg-zinc-200" />
    </section>
  );
}

function SignUpFormFields() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirectedFrom");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("Please enter your full name.");
      return;
    }
    if (password.length < CUSTOMER_SIGNUP_MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${CUSTOMER_SIGNUP_MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        throw new SupabaseBrowserConfigError();
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: buildCustomerSignupMetadata(trimmedName),
          emailRedirectTo: buildCustomerSignupEmailRedirectUrl(window.location.origin),
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (!data.session) {
        const checkEmailUrl = new URL(SIGN_UP_CHECK_EMAIL_PATH, window.location.origin);
        if (trimmedEmail) {
          checkEmailUrl.searchParams.set("email", trimmedEmail);
        }
        router.replace(checkEmailUrl.pathname + checkEmailUrl.search);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        setError(userError?.message ?? "Account created but session could not be loaded.");
        await supabase.auth.signOut();
        return;
      }

      const profileResult = await loadProfileRoleForUser(supabase, user.id);
      if (!profileResult.ok) {
        setError(profileResult.error);
        await supabase.auth.signOut();
        return;
      }

      if (profileResult.role !== "customer") {
        setError("This sign-up path is for customer accounts only.");
        await supabase.auth.signOut();
        return;
      }

      const destination = resolvePostCustomerSignUpPath(redirectedFrom);
      router.replace(destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed.");
    } finally {
      setLoading(false);
    }
  }

  const inputClassName =
    "rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">Full name</span>
        <input
          type="text"
          name="fullName"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={CUSTOMER_SIGNUP_MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClassName}
        />
        <span className="text-xs text-zinc-500">
          At least {CUSTOMER_SIGNUP_MIN_PASSWORD_LENGTH} characters.
        </span>
      </label>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className={`${UI_BUTTON_PRIMARY_CLASS} disabled:opacity-60`}
      >
        {loading ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link
          href={SIGN_IN_PATH}
          className="font-medium text-zinc-900 underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <SignUpFormSkeleton />;
  }

  return <SignUpFormFields />;
}
