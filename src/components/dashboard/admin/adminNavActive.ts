/** Returns whether `href` is the active admin nav destination for `pathname`. */
export function isAdminNavItemActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;

  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
