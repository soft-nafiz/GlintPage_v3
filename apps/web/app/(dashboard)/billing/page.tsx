import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PricingClient } from "./pricing-client";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "plan, subscription_status, trial_ends_at, has_used_trial, current_period_end, cancel_at_period_end",
    )
    .eq("id", user.id)
    .single();

  const params = await searchParams;

  return (
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
  );
}
