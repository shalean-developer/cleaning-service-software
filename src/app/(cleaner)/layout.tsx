import { requireProfileRole } from "@/lib/auth/requireProfileRole";

export default async function CleanerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireProfileRole(["cleaner"]);
  return children;
}
