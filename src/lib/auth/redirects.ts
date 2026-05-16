import type { UserRole } from "@/lib/database/types";

export const SIGN_IN_PATH = "/sign-in" as const;

const ROLE_HOME: Record<UserRole, string> = {
  customer: "/customer",
  cleaner: "/cleaner",
  admin: "/admin",
};

/** Default dashboard path for a profile role. */
export function homePathForRole(role: UserRole | null | undefined): string {
  if (role && role in ROLE_HOME) {
    return ROLE_HOME[role as UserRole];
  }
  return SIGN_IN_PATH;
}

/** Whether a post-login redirect target is allowed for the given role. */
export function isDashboardPathAllowedForRole(path: string, role: UserRole): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (role === "customer") return path === "/customer" || path.startsWith("/customer/");
  if (role === "cleaner") return path === "/cleaner" || path.startsWith("/cleaner/");
  if (role === "admin") return path === "/admin" || path.startsWith("/admin/");
  return false;
}

/**
 * Resolves where to send the user after sign-in.
 * Prefers `redirectedFrom` when it matches the user's role namespace.
 */
export function resolvePostSignInPath(
  role: UserRole,
  redirectedFrom: string | null | undefined,
): string {
  const trimmed = redirectedFrom?.trim();
  if (trimmed && isDashboardPathAllowedForRole(trimmed, role)) {
    return trimmed;
  }
  return homePathForRole(role);
}

export const CUSTOMER_SETUP_PATH = "/customer/setup" as const;

/** Builds `/customer/setup?redirectedFrom=…` for incomplete customer provisioning. */
export function buildCustomerSetupRedirectPath(redirectedFrom?: string | null): string {
  const trimmed = redirectedFrom?.trim();
  if (
    trimmed &&
    trimmed !== CUSTOMER_SETUP_PATH &&
    isDashboardPathAllowedForRole(trimmed, "customer")
  ) {
    const params = new URLSearchParams({ redirectedFrom: trimmed });
    return `${CUSTOMER_SETUP_PATH}?${params.toString()}`;
  }
  return CUSTOMER_SETUP_PATH;
}

/** Builds `/sign-in?redirectedFrom=…` for unauthenticated dashboard access. */
export function buildSignInRedirectPath(redirectedFrom?: string | null): string {
  if (!redirectedFrom?.trim()) {
    return SIGN_IN_PATH;
  }
  const path = redirectedFrom.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith(SIGN_IN_PATH)) {
    return SIGN_IN_PATH;
  }
  const params = new URLSearchParams({ redirectedFrom: path });
  return `${SIGN_IN_PATH}?${params.toString()}`;
}

/** Role required to access a dashboard path prefix (middleware / guards). */
export function requiredRoleForDashboardPath(pathname: string): UserRole | null {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/cleaner")) return "cleaner";
  if (pathname.startsWith("/customer")) return "customer";
  return null;
}
