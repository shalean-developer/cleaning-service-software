/** Detects cleaner-oriented sign-in entry (dashboard, apply CTA, cleaner paths). */
export function isCleanerSignInIntent(redirectedFrom: string | null | undefined): boolean {
  const path = redirectedFrom?.trim();
  if (!path) return false;
  if (path.startsWith("/cleaner")) return true;
  if (path.includes("cleaner")) return true;
  return false;
}

/** Detects customer booking/sign-up oriented redirect targets. */
export function isCustomerSignInIntent(redirectedFrom: string | null | undefined): boolean {
  const path = redirectedFrom?.trim();
  if (!path) return false;
  return path.startsWith("/customer");
}

export type SignInPageCopy = {
  title: string;
  subtitle: string;
};

export function resolveSignInPageCopy(
  redirectedFrom: string | null | undefined,
): SignInPageCopy {
  if (isCleanerSignInIntent(redirectedFrom)) {
    return {
      title: "Cleaner sign in",
      subtitle: "Sign in to manage jobs, availability, and payouts.",
    };
  }

  if (isCustomerSignInIntent(redirectedFrom)) {
    return {
      title: "Welcome back",
      subtitle: "Sign in to manage your bookings, payments, and cleaning schedule.",
    };
  }

  return {
    title: "Welcome back",
    subtitle: "Sign in to manage your bookings, payments, and cleaning schedule.",
  };
}
