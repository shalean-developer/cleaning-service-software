import { requireProfileRole } from "@/lib/auth/requireProfileRole";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireProfileRole(["admin"]);
  return children;
}
