import type { Metadata } from "next";
import { MarketingLegalPage } from "@/components/marketing/MarketingLegalPage";
import { buildMarketingMetadata } from "@/features/marketing/metadata";
import { LEGAL_PAGES } from "@/features/marketing/legal-pages";

const content = LEGAL_PAGES.privacy;

export const metadata: Metadata = buildMarketingMetadata({
  title: content.metaTitle,
  description: content.metaDescription,
  path: content.path,
});

export default function PrivacyPage() {
  return <MarketingLegalPage content={content} />;
}
