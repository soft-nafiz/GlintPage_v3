import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { CurrentProfile } from "@/lib/auth/types";

export const getServerSupabase = cache(async () => createClient());

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  return user;
}

export const getCurrentProfile =
  cache(async (): Promise<CurrentProfile | null> => {
    const user = await getCurrentUser();
    if (!user) return null;

    const supabase = await getServerSupabase();
    const { data } = await supabase
      .from("profiles")
      .select(
        [
          "id",
          "email",
          "full_name",
          "avatar_url",
          "plan",
          "subscription_status",
          "trial_ends_at",
          "has_used_trial",
          "current_period_end",
          "cancel_at_period_end",
          "customer_portal_url",
          "prefetch_enabled",
        ].join(", "),
      )
      .eq("id", user.id)
      .maybeSingle();

    return data as CurrentProfile | null;
  });

export const getCurrentAccount = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return { user: null, profile: null };

  const profile = await getCurrentProfile();
  return { user, profile };
});
