import { requireProfileRole } from "@/lib/auth/requireProfileRole";

export default async function CustomerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireProfileRole(["customer"]);
  return children;
}
