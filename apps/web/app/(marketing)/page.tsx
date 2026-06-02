import CtaSection from "@/components/landing/CtaSection";
import { DemoSection } from "@/components/landing/DemoSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { PricingClient } from "../(dashboard)/billing/pricing-client";
import { createClient } from "@/lib/supabase/server";

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
        profile={
          profile ?? {
            plan: "free",
            subscription_status: null,
            trial_ends_at: null,
            has_used_trial: false,
            current_period_end: null,
            cancel_at_period_end: false,
          }
        }
        showSuccess={params.success === "true"}
        showCanceled={params.canceled === "true"}
      />
      <CtaSection />
      {/* <Footer /> */}
    </main>
  );
}
