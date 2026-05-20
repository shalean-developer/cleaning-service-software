import { MarketingHashCleanup } from "./MarketingHashCleanup";
import { MarketingHeader } from "./MarketingHeader";
import { MarketingMobileBar } from "./MarketingMobileBar";
import { MarketingSkipLink } from "./MarketingSkipLink";
import { FaqCtaSection } from "./sections/FaqCtaSection";
import { HeroSection } from "./sections/HeroSection";
import { HowItWorksSection } from "./sections/HowItWorksSection";
import { MarketingFooter } from "./sections/MarketingFooter";
import { PricingAreasSection } from "./sections/PricingAreasSection";
import { ReviewsSection } from "./sections/ReviewsSection";
import { ServicesSection } from "./sections/ServicesSection";
import { WhyChooseSection } from "./sections/WhyChooseSection";

export function MarketingHomePage() {
  return (
    <>
      <MarketingHashCleanup />
      <MarketingSkipLink />
      <MarketingHeader />
      <main id="main-content" className="bg-shalean-surface pb-24 lg:pb-0" tabIndex={-1}>
        <HeroSection />
        <ServicesSection />
        <HowItWorksSection />
        <WhyChooseSection />
        <ReviewsSection />
        <PricingAreasSection />
        <FaqCtaSection />
      </main>
      <MarketingFooter />
      <MarketingMobileBar />
    </>
  );
}
