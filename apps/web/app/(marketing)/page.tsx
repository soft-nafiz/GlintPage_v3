import CtaSection from "@/components/landing/CtaSection";
import { DemoSection } from "@/components/landing/DemoSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { PricingClient } from "../(dashboard)/billing/pricing-client";
import { createClient } from "@/lib/supabase/server";
import { createMetadata } from "@/lib/seo";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select(
        "plan, subscription_status, trial_ends_at, has_used_trial, current_period_end, cancel_at_period_end",
      )
      .eq("id", user.id)
      .single();

    // 2. Assign the fetched data to our outer variable
    profile = data;
  }

  const params = await searchParams;
  return (
    <main>
      <HeroSection />
      <FeaturesSection />
      <DemoSection />
      <PricingClient
        profile={profile}
        showSuccess={params.success === "true"}
        showCanceled={params.canceled === "true"}
      />
      <CtaSection />
      {/* <Footer /> */}
    </main>
  );
}
