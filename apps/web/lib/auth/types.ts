export type CurrentProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  plan: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  has_used_trial: boolean | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  customer_portal_url: string | null;
  prefetch_enabled: boolean | null;
};

export type PricingProfile = {
  plan: string;
  subscription_status: string | null;
  trial_ends_at: string | null;
  has_used_trial: boolean;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export function toPricingProfile(
  profile: CurrentProfile | null,
): PricingProfile | null {
  if (!profile) return null;

  return {
    plan: profile.plan ?? "free",
    subscription_status: profile.subscription_status,
    trial_ends_at: profile.trial_ends_at,
    has_used_trial: profile.has_used_trial ?? false,
    current_period_end: profile.current_period_end,
    cancel_at_period_end: profile.cancel_at_period_end ?? false,
  };
}
