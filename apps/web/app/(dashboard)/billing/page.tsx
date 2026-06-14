import { PricingClient } from "./pricing-client";
import { createMetadata } from "@/lib/seo";
import { getCurrentProfile, requireCurrentUser } from "@/lib/auth/server";
import { toPricingProfile } from "@/lib/auth/types";

export const metadata = createMetadata({
  title: "Billing and plans",
  description:
    "Manage Glintpage plans, billing status, cancellations, and AI reading limits.",
  path: "/billing",
  noIndex: true,
});

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const [, profile, params] = await Promise.all([
    requireCurrentUser(),
    getCurrentProfile(),
    searchParams,
  ]);

  return (
    <PricingClient
      profile={
        toPricingProfile(profile) ?? {
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
  );
}
