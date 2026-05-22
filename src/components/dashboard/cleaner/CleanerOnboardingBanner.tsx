import Link from "next/link";
import type { CleanerOperationalState } from "@/features/cleaners/server/lifecycle/operationalState";

type Props = {
  operationalState: CleanerOperationalState;
  hasCapabilities: boolean;
  hasAvailability: boolean;
};

const ONBOARDING_CHECKLIST = [
  "Profile and contact details verified by Shalean",
  "Service areas and capabilities configured",
  "Weekly availability set for your service areas",
  "Background and onboarding review completed",
] as const;

export function CleanerOnboardingBanner({
  operationalState,
  hasCapabilities,
  hasAvailability,
}: Props) {
  if (operationalState === "active") {
    return null;
  }

  if (operationalState === "onboarding") {
    return (
      <section
        className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-950"
        role="status"
        aria-live="polite"
      >
        <h2 className="font-semibold text-sky-950">Your account is still under review</h2>
        <p className="mt-2 leading-relaxed text-sky-900">
          We&apos;re setting up your cleaner profile and service areas. You&apos;ll begin
          receiving offers once onboarding is complete.
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sky-900">
          {ONBOARDING_CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
          {!hasCapabilities ? (
            <li className="text-sky-800">Service capabilities — pending</li>
          ) : null}
          {!hasAvailability ? (
            <li className="text-sky-800">Weekly availability — pending</li>
          ) : null}
        </ul>
        <p className="mt-3 text-sky-800">
          Questions?{" "}
          <Link href="/contact" className="font-medium underline-offset-2 hover:underline">
            Contact support
          </Link>
        </p>
      </section>
    );
  }

  if (operationalState === "suspended") {
    return (
      <section
        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950"
        role="status"
      >
        <h2 className="font-semibold">Account suspended</h2>
        <p className="mt-2 leading-relaxed">
          Your account is temporarily suspended and cannot receive new offers. Contact Shalean
          support if you believe this is an error.
        </p>
        <p className="mt-3">
          <Link href="/contact" className="font-medium underline-offset-2 hover:underline">
            Contact support
          </Link>
        </p>
      </section>
    );
  }

  if (operationalState === "inactive") {
    return (
      <section
        className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-800"
        role="status"
      >
        <h2 className="font-semibold text-zinc-900">Account inactive</h2>
        <p className="mt-2 leading-relaxed">
          Your cleaner account is inactive and not receiving new offers. Contact Shalean if you
          need to return to the network.
        </p>
        <p className="mt-3">
          <Link href="/contact" className="font-medium text-zinc-900 underline-offset-2 hover:underline">
            Contact support
          </Link>
        </p>
      </section>
    );
  }

  if (operationalState === "archived") {
    return (
      <section
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-950"
        role="status"
      >
        <h2 className="font-semibold">Account archived</h2>
        <p className="mt-2 leading-relaxed">
          This cleaner account has been archived. Contact Shalean support for assistance.
        </p>
      </section>
    );
  }

  return null;
}

/** Empty-state copy when offers/jobs lists are empty due to non-active operational state. */
export function cleanerOperationalEmptyOffersCopy(
  operationalState: CleanerOperationalState,
): { title: string; description: string } | null {
  if (operationalState === "active") return null;
  if (operationalState === "onboarding") {
    return {
      title: "Offers will appear after onboarding",
      description:
        "You are not in the assignment pool yet. We will notify you when your account is active.",
    };
  }
  if (operationalState === "suspended") {
    return {
      title: "No offers while suspended",
      description: "New job offers are paused until your account is reinstated.",
    };
  }
  if (operationalState === "inactive") {
    return {
      title: "No offers while inactive",
      description: "Reactivate your account with Shalean to receive job offers again.",
    };
  }
  return {
    title: "Offers unavailable",
    description: "This account cannot receive offers in its current state.",
  };
}

export function cleanerOperationalEmptyJobsCopy(
  operationalState: CleanerOperationalState,
): { title: string; description: string } | null {
  if (operationalState === "active") return null;
  if (operationalState === "onboarding") {
    return {
      title: "Jobs will appear after onboarding",
      description: "Assigned jobs show here once your account is operational.",
    };
  }
  return cleanerOperationalEmptyOffersCopy(operationalState);
}
