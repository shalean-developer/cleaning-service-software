import type { Metadata } from "next";
import { PLATFORM_NOINDEX_METADATA } from "@/features/marketing/metadata";
import { requireProfileRole } from "@/lib/auth/requireProfileRole";

export const metadata: Metadata = PLATFORM_NOINDEX_METADATA;

export default async function CleanerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireProfileRole(["cleaner"]);
  return children;
}
