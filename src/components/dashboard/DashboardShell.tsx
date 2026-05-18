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
          <nav className="-mx-4 flex items-center gap-2 overflow-x-auto scroll-px-4 px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
              >
                {item.label}
              </Link>
            ))}
            <SignOutButton className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-60" />
          </nav>
        </section>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </section>
  );
}
