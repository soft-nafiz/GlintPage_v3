import CtaSection from "@/components/landing/CtaSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import {
  CognitiveAuditSection,
  FreeLibrarySection,
  InvestmentFrameworkSection,
} from "@/components/landing/GrowthSections";
import { HeroSection } from "@/components/landing/HeroSection";
import { PricingClient } from "../(dashboard)/billing/pricing-client";
import { createMetadata } from "@/lib/seo";
import { getCurrentProfile } from "@/lib/auth/server";
import { toPricingProfile } from "@/lib/auth/types";
import { redirect } from "next/navigation";

export const metadata = createMetadata({
  title: "AI Book Reader, Translator, and Growth Library",
  description:
    "Glintpage helps ambitious readers translate books, summarize lasting insights, and build a calmer multilingual reading life in a distraction-free AI reader.",
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

  if (profile) {
    redirect("/dashboard");
  }

  return (
    <main>
      <HeroSection />
      <CognitiveAuditSection />
      <InvestmentFrameworkSection />
      <FeaturesSection />
      <FreeLibrarySection />
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
