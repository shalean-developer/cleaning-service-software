import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  buildCustomerSetupRedirectPath,
  buildSignInRedirectPath,
  homePathForRole,
} from "./redirects";
import { checkCustomerReadiness } from "./customerReadiness";

/**
 * Redirects unauthenticated users to sign-in, wrong roles to their home dashboard,
 * and customers without a customers row to `/customer/setup`.
 */
export async function requireCustomerReadyForPath(pathname: string): Promise<void> {
  const readiness = await checkCustomerReadiness();

  if (readiness.status === "ready") {
    return;
  }

  if (readiness.status === "unauthenticated") {
    redirect(buildSignInRedirectPath(pathname));
  }

  if (readiness.status === "wrong_role") {
    redirect(homePathForRole(readiness.user.role));
  }

  redirect(buildCustomerSetupRedirectPath(pathname));
}

/** Uses `x-pathname` from proxy when no explicit path is passed. */
export async function requireCustomerReady(redirectedFrom?: string): Promise<void> {
  const pathname =
    redirectedFrom?.trim() ||
    (await headers()).get("x-pathname")?.trim() ||
    "/customer";
  await requireCustomerReadyForPath(pathname);
}
