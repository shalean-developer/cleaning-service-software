import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";

export type NavItem = {
  href: string;
  label: string;
};

type Props = {
  title: string;
  subtitle?: string;
  nav: NavItem[];
  children: React.ReactNode;
};

export function DashboardShell({ title, subtitle, nav, children }: Props) {
  return (
    <section className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <section className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <section>
            <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
            {subtitle ? <p className="text-sm text-zinc-600">{subtitle}</p> : null}
          </section>
          <nav className="flex flex-wrap items-center gap-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {item.label}
              </Link>
            ))}
            <SignOutButton />
          </nav>
        </section>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </section>
  );
}
