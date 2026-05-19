import Link from "next/link";
import { UI_BUTTON_PRIMARY_CLASS } from "@/lib/ui/productUiTokens";

/** Primary empty-state CTA for customer booking list surfaces. */
export function CustomerBookACleanCta() {
  return (
    <Link
      href="/customer/book"
      className={UI_BUTTON_PRIMARY_CLASS}
    >
      Book a clean
    </Link>
  );
}
