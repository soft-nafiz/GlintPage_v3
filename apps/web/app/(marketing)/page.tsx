import CtaSection from "@/components/landing/CtaSection";
import { DemoSection } from "@/components/landing/DemoSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { PricingClient } from "../(dashboard)/billing/pricing-client";
import { createMetadata } from "@/lib/seo";
import { getCurrentProfile } from "@/lib/auth/server";
import { toPricingProfile } from "@/lib/auth/types";

export const metadata = createMetadata({
  title: "AI Book Reader and Translator for PDFs, EPUBs, and Public Books",
  description:
    "Glintpage helps readers translate books, summarize chapters, listen to page audio, and read PDFs or EPUBs in a beautiful distraction-free interface.",
  path: "/",
  keywords: [
    "AI book reader",
    "translate EPUB",
    "translate PDF",
    "AI reading assistant",
    "multilingual book reader",
  ],
});

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const [profile, params] = await Promise.all([
    getCurrentProfile(),
    searchParams,
  ]);

  return (
    <main>
      <HeroSection />
      <FeaturesSection />
      <DemoSection />
      <PricingClient
        profile={toPricingProfile(profile)}
        showSuccess={params.success === "true"}
        showCanceled={params.canceled === "true"}
      />
      <CtaSection />
      {/* <Footer /> */}
    </main>
  );
}
