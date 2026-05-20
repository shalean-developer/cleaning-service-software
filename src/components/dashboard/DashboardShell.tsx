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
  /** Sticky header with backdrop blur (customer hub). */
  stickyHeader?: boolean;
  /** Trailing header slot (e.g. profile menu). */
  headerEnd?: React.ReactNode;
  /**
   * Show sign out in the top nav. Defaults to false when `headerEnd` is set
   * (account actions live in the profile menu).
   */
  showNavSignOut?: boolean;
  /** Override main content wrapper classes. */
  mainClassName?: string;
};

export function DashboardShell({
  title,
  subtitle,
  nav,
  children,
  stickyHeader = false,
  headerEnd,
  showNavSignOut,
  mainClassName,
}: Props) {
  const showTitleBlock = Boolean(title?.trim() || subtitle?.trim());
  const mainClass =
    mainClassName ?? "mx-auto min-w-0 max-w-5xl px-4 py-6 sm:py-8";
  const navSignOut = showNavSignOut ?? !headerEnd;

  return (
    <section className="min-h-screen overflow-x-clip bg-zinc-50">
      <header
        className={
          stickyHeader
            ? "sticky top-0 z-30 border-b border-zinc-200/80 bg-white/85 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md supports-[backdrop-filter]:bg-white/75"
            : "relative border-b border-zinc-200 bg-white"
        }
      >
        <section className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5 sm:gap-4 sm:py-4">
          {showTitleBlock ? (
            <section className="min-w-0 flex-1">
              {title?.trim() ? (
                <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
              ) : null}
              {subtitle?.trim() ? (
                <p className="break-words text-sm text-zinc-600">{subtitle}</p>
              ) : null}
            </section>
          ) : (
            <span className="flex-1" aria-hidden />
          )}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <DashboardShellNav nav={nav} showSignOut={navSignOut} />
            {headerEnd}
          </div>
        </section>
      </header>
      <main className={mainClass}>{children}</main>
    </section>
  );
}
