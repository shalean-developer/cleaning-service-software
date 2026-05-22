import type { ReactNode } from "react";
import {
  WizardBookingSummaryMobileCard,
  WizardBookingSummarySidebar,
} from "./WizardBookingSummarySidebar";
import type { WizardBookingSummarySnapshot } from "../wizardBookingSummaryDisplay";

type Props = {
  /** Step card + form content only; sidebar is rendered by this layout. */
  children: ReactNode;
  snapshot: WizardBookingSummarySnapshot;
  footnote?: string;
};

/**
 * Shell-level two-column layout for details/cleaner steps.
 * Used only from BookingWizard. step panels must not import or wrap this.
 */
export function WizardBookingSummaryLayout({ children, snapshot, footnote }: Props) {
  const summaryProps = { snapshot, footnote };

  return (
    <div className="min-w-0">
      <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_17.5rem] md:items-start md:gap-6">
        <div className="min-w-0">{children}</div>
        <WizardBookingSummarySidebar {...summaryProps} />
      </div>
      <div className="mt-4 md:hidden">
        <WizardBookingSummaryMobileCard {...summaryProps} />
      </div>
    </div>
  );
}
