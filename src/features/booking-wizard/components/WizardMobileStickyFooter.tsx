import type { ReactNode } from "react";
import {
  WIZARD_MAIN_COLUMN_CLASS,
  WIZARD_MOBILE_STICKY_FOOTER_CLASS,
  WIZARD_NAV_IN_STICKY_FOOTER_CLASS,
  WIZARD_STICKY_FOOTER_INNER_CLASS,
} from "../wizardLayout";

type Props = {
  summary?: ReactNode;
  children: ReactNode;
  innerClassName?: string;
};

/** Mobile-fixed footer combining optional commerce summary + nav; desktop in normal flow. */
export function WizardMobileStickyFooter({
  summary,
  children,
  innerClassName = WIZARD_STICKY_FOOTER_INNER_CLASS,
}: Props) {
  return (
    <div className={WIZARD_MOBILE_STICKY_FOOTER_CLASS}>
      <div className={innerClassName}>
        <div className={WIZARD_MAIN_COLUMN_CLASS}>
          {summary}
          <div className={WIZARD_NAV_IN_STICKY_FOOTER_CLASS}>{children}</div>
        </div>
      </div>
    </div>
  );
}
