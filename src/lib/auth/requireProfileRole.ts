import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/database/types";
import { buildSignInRedirectPath, homePathForRole } from "./redirects";
import { getCurrentUser } from "./getCurrentUser";

export class ForbiddenError extends Error {
  readonly status = 403 as const;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Ensures the current session profile has one of the allowed roles.
 * Redirects to `/sign-in` when unauthenticated; redirects to the user's home dashboard on role mismatch.
 */
export async function requireProfileRole(
  allowed: ReadonlyArray<UserRole>,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    const pathname = (await headers()).get("x-pathname");
    redirect(buildSignInRedirectPath(pathname));
  }
  if (!allowed.includes(user.role)) {
    redirect(homePathForRole(user.role));
  }
}
