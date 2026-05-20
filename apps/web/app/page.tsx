import CtaSection from "@/components/landing/CtaSection";
import { DemoSection } from "@/components/landing/DemoSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { PricingSection } from "@/components/landing/PricingSection";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <FeaturesSection />
      <DemoSection />
      <PricingSection />
      <CtaSection />
      {/* <Footer /> */}
    </main>
  );
}
