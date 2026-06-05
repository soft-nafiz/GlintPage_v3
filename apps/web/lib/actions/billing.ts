"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCheckout, getSubscription } from "@lemonsqueezy/lemonsqueezy.js";
import { STORE_ID, VARIANT_IDS } from "@/lib/lemonsqueezy";

type Plan = "plus" | "pro";

export async function createCheckoutSession(plan: Plan) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("auth/login");

  console.log(user, "here is user");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", user.id)
    .single();

  console.log(profile, "user profile");

  const { data, error } = await createCheckout(STORE_ID, VARIANT_IDS[plan], {
    checkoutOptions: {
      embed: false,
      media: false,
    },
    checkoutData: {
      email: profile?.email ?? "",
      name: profile?.full_name ?? "",
      // Pass user ID so webhook can find the profile
      custom: {
        user_id: user.id,
      },
    },
    productOptions: {
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
      receiptLinkUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
      enabledVariants: [VARIANT_IDS[plan]],
    },
  });

  if (error || !data?.data?.attributes?.url) {
    console.error("[billing] checkout creation failed:", error);
    redirect("/billing?error=true");
  }

  redirect(data.data.attributes.url);
}

export async function createPortalSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("lemonsqueezy_subscription_id, customer_portal_url")
    .eq("id", user.id)
    .single();

  // Use cached portal URL if available
  if (profile?.customer_portal_url) {
    redirect(profile.customer_portal_url);
  }

  // Fetch fresh from LS API
  if (!profile?.lemonsqueezy_subscription_id) {
    redirect("/billing");
  }

  const { data: sub, error } = await getSubscription(
    profile.lemonsqueezy_subscription_id,
  );

  if (error || !sub?.data?.attributes?.urls?.customer_portal) {
    console.error("[billing] portal fetch failed:", error);
    redirect("/billing");
  }

  const portalUrl = sub.data.attributes.urls.customer_portal;

  // Cache it for next time
  await supabase
    .from("profiles")
    .update({ customer_portal_url: portalUrl })
    .eq("id", user.id);

  redirect(portalUrl);
}
