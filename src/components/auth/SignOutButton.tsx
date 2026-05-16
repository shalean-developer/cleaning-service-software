"use client";

import { useTransition } from "react";
import { signOut } from "@/lib/auth/signOut";

type Props = {
  className?: string;
};

export function SignOutButton({ className }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => signOut())}
      className={
        className ??
        "rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
      }
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
