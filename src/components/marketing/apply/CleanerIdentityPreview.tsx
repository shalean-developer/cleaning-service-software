"use client";

import { ShieldCheck } from "lucide-react";
import { buildCleanerIdentityEmail } from "@/features/cleaners/cleanerIdentity";

const PREVIEW_CLASS =
  "mt-2 flex items-center gap-3 rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3.5 font-mono text-sm text-shalean-navy";

type Props = {
  phone: string;
};

export function CleanerIdentityPreview({ phone }: Props) {
  const identityEmail = buildCleanerIdentityEmail(phone);
  const display = identityEmail ?? "Phone number required";

  return (
    <div className="rounded-xl border border-shalean-primary/15 bg-shalean-primary/[0.04] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-shalean-primary/10 text-shalean-primary">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800">Your Shalean cleaner sign-in ID</p>
          <output className={PREVIEW_CLASS} aria-live="polite">
            {display}
          </output>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Your cleaner account email is automatically created from your phone number after
            approval.
          </p>
        </div>
      </div>
    </div>
  );
}
