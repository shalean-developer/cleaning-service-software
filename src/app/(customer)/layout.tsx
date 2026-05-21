import type { Metadata } from "next";
import { headers } from "next/headers";
import { PLATFORM_NOINDEX_METADATA } from "@/features/marketing/metadata";
import { CUSTOMER_SETUP_PATH, requireProfileRole } from "@/lib/auth";
import { requireCustomerReadyForPath } from "@/lib/auth/requireCustomerReady";

export const metadata: Metadata = PLATFORM_NOINDEX_METADATA;

export default async function CustomerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireProfileRole(["customer"]);

  const pathname = (await headers()).get("x-pathname") ?? "";
  if (!pathname.startsWith(CUSTOMER_SETUP_PATH)) {
    await requireCustomerReadyForPath(pathname || "/customer");
  }

  return children;
}
