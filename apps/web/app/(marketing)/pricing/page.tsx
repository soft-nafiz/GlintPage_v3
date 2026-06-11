import { PricingClient } from "@/app/(dashboard)/billing/pricing-client";
import { createMetadata } from "@/lib/seo";
import { getCurrentProfile } from "@/lib/auth/server";
import { toPricingProfile } from "@/lib/auth/types";

export const metadata = createMetadata({
  title: "Pricing",
  description:
    "Compare Glintpage pricing plans for AI translation, chapter summaries, audio reading, and multilingual book reading.",
  path: "/pricing",
  keywords: [
    "Glintpage pricing",
    "AI reader pricing",
    "book translator pricing",
    "EPUB translation pricing",
  ],
});

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const [profile, params] = await Promise.all([
    getCurrentProfile(),
    searchParams,
  ]);

  return (
    <PricingClient
      profile={toPricingProfile(profile)}
      showSuccess={params.success === "true"}
      showCanceled={params.canceled === "true"}
    />
  );
}
