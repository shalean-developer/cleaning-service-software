import type { Metadata } from "next";
import { MarketingBreadcrumbs } from "@/components/marketing/MarketingBreadcrumbs";
import { MarketingSeoShell } from "@/components/marketing/MarketingSeoShell";
import { ApplyFormPageSections } from "@/components/marketing/apply/ApplyFormPageSections";
import {
  APPLY_FORM_PAGE_META,
  APPLY_PAGE_PATH,
} from "@/features/marketing/apply-page-content";
import { APPLY_FORM_PAGE_PATH } from "@/features/marketing/marketing-routes";
import { buildMarketingNoindexMetadata } from "@/features/marketing/metadata";

export const metadata: Metadata = buildMarketingNoindexMetadata({
  title: APPLY_FORM_PAGE_META.title,
  description: APPLY_FORM_PAGE_META.description,
  path: APPLY_FORM_PAGE_PATH,
});

export default function ApplyApplicationFormPage() {
  return (
    <MarketingSeoShell>
      <ApplyFormPageSections
        breadcrumbs={
          <MarketingBreadcrumbs
            items={[
              { label: "Home", href: "/", icon: "home" },
              { label: "Apply", href: APPLY_PAGE_PATH },
              { label: "Application form" },
            ]}
          />
        }
      />
    </MarketingSeoShell>
  );
}
