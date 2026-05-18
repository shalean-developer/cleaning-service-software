import { DashboardShellNav } from "@/components/dashboard/DashboardShellNav";

export type NavItem = {
  href: string;
  label: string;
};

type Props = {
  title?: string;
  subtitle?: string;
  nav: NavItem[];
  children: React.ReactNode;
};

export function DashboardShell({ title, subtitle, nav, children }: Props) {
  const showTitleBlock = Boolean(title?.trim() || subtitle?.trim());

  return (
    <section className="min-h-screen bg-zinc-50">
      <header className="relative border-b border-zinc-200 bg-white">
        <section className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          {showTitleBlock ? (
            <section className="min-w-0 flex-1">
              {title?.trim() ? (
                <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
              ) : null}
              {subtitle?.trim() ? <p className="text-sm text-zinc-600">{subtitle}</p> : null}
            </section>
          ) : (
            <span className="flex-1" aria-hidden />
          )}
          <DashboardShellNav nav={nav} />
        </section>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </section>
  );
}
