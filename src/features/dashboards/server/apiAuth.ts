import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import type { UserRole } from "@/lib/database/types";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export type ApiAuthFailure = {
  ok: false;
  status: number;
  error: string;
  message?: string;
};

export function isApiAuthFailure(
  user: CurrentUser | ApiAuthFailure,
): user is ApiAuthFailure {
  return "ok" in user && user.ok === false;
}

export async function requireApiUser(
  allowedRoles: readonly UserRole[],
): Promise<CurrentUser | ApiAuthFailure> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, status: 401, error: "UNAUTHORIZED", message: "Sign in required." };
  }
  if (!allowedRoles.includes(user.role)) {
    return { ok: false, status: 403, error: "FORBIDDEN", message: "Insufficient role." };
  }
  return user;
}
