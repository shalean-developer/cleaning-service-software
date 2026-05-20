"use client";

import { useTransition, type ReactNode } from "react";
import { signOut } from "@/lib/auth/signOut";

type Props = {
  className?: string;
  leadingIcon?: ReactNode;
  /** Runs before the shared sign-out action (e.g. close a profile menu). */
  onBeforeSignOut?: () => void;
};

export function SignOutButton({ className, leadingIcon, onBeforeSignOut }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        onBeforeSignOut?.();
        startTransition(() => signOut());
      }}
      className={
        className ??
        "rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
      }
    >
      {leadingIcon}
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
