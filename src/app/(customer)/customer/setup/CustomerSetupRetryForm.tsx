"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { retryCustomerProvisioning } from "./actions";

type Props = {
  redirectedFrom: string | null;
};

export function CustomerSetupRetryForm({ redirectedFrom }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleRetry() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await retryCustomerProvisioning();
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      const target = redirectedFrom?.trim() || "/customer";
      router.replace(target);
      router.refresh();
    });
  }

  return (
    <section className="mt-8 space-y-4">
      <button
        type="button"
        onClick={handleRetry}
        disabled={pending}
        className="inline-flex rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Finishing setup…" : "Finish account setup"}
      </button>
      {errorMessage ? (
        <p className="text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
