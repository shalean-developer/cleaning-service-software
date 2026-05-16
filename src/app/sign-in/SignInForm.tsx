"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadProfileRoleForUser } from "@/lib/auth/loadProfileRole";
import { resolvePostSignInPath } from "@/lib/auth/redirects";
import {
  createSupabaseBrowserClient,
  SupabaseBrowserConfigError,
} from "@/lib/supabase/browser";

/** Static placeholder — avoids hydration mismatch when extensions inject form attributes. */
function SignInFormSkeleton() {
  return (
    <section className="flex flex-col gap-4" aria-hidden>
      <div className="h-[66px] rounded-lg bg-zinc-100" />
      <div className="h-[66px] rounded-lg bg-zinc-100" />
      <div className="h-10 rounded-xl bg-zinc-200" />
    </section>
  );
}

function SignInFormFields() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirectedFrom");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        throw new SupabaseBrowserConfigError();
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        setError(userError?.message ?? "Signed in but session user could not be loaded.");
        await supabase.auth.signOut();
        return;
      }

      const profileResult = await loadProfileRoleForUser(supabase, user.id);
      if (!profileResult.ok) {
        setError(profileResult.error);
        await supabase.auth.signOut();
        return;
      }

      const destination = resolvePostSignInPath(profileResult.role, redirectedFrom);
      router.replace(destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
        />
      </label>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function SignInForm() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <SignInFormSkeleton />;
  }

  return <SignInFormFields />;
}
