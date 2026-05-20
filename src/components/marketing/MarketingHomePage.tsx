import { MarketingHeader } from "./MarketingHeader";
import { MarketingMobileBar } from "./MarketingMobileBar";
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
      <MarketingHeader />
      <main className="bg-shalean-surface pb-20 md:pb-0">
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
