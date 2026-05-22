import { SIGN_UP_PATH } from "./customerSignup";
import { SIGN_IN_PATH } from "./redirects";

/** Preserves booking redirect through sign-in ↔ sign-up navigation. */
export function buildAuthPathWithRedirect(
  basePath: typeof SIGN_IN_PATH | typeof SIGN_UP_PATH,
  redirectedFrom: string | null | undefined,
): string {
  const trimmed = redirectedFrom?.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return basePath;
  }
  const params = new URLSearchParams({ redirectedFrom: trimmed });
  return `${basePath}?${params.toString()}`;
}
