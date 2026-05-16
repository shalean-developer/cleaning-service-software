import { headers } from "next/headers";
import { CUSTOMER_SETUP_PATH, requireProfileRole } from "@/lib/auth";
import { requireCustomerReadyForPath } from "@/lib/auth/requireCustomerReady";

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
