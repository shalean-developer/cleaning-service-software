/** True when search should scan auth.users emails (not only company/phone). */
export function isEmailLikeCustomerSearch(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (trimmed.includes("@")) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
