import type { ReactNode } from "react";
import {
  WIZARD_MAIN_COLUMN_CLASS,
  WIZARD_MOBILE_STICKY_FOOTER_CLASS,
  WIZARD_STICKY_FOOTER_INNER_CLASS,
} from "../wizardLayout";

type Props = {
  summary?: ReactNode;
  children: ReactNode;
};

/** Mobile-fixed footer combining optional commerce summary + nav; desktop in normal flow. */
export function WizardMobileStickyFooter({ summary, children }: Props) {
  return (
    <div className={WIZARD_MOBILE_STICKY_FOOTER_CLASS}>
      <div className={WIZARD_STICKY_FOOTER_INNER_CLASS}>
        <div className={WIZARD_MAIN_COLUMN_CLASS}>
          {summary}
          <div className="mt-0 md:mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
