import "server-only";

import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/database/types";
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
 * Redirects to `/` when unauthenticated; throws {@link ForbiddenError} when authenticated but unauthorized.
 */
export async function requireProfileRole(
  allowed: ReadonlyArray<UserRole>,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }
  if (!allowed.includes(user.role)) {
    throw new ForbiddenError(
      `This area requires one of: ${allowed.join(", ")} (current role: ${user.role}).`,
    );
  }
}
