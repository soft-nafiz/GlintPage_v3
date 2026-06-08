import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type LemonSqueezyAttributes = {
  variant_id: number;
  status: string;
  renews_at?: string | null;
  trial_ends_at?: string | null;
  cancelled?: boolean | null;
  customer_id?: string | number | null;
  urls?: {
    customer_portal?: string | null;
  };
};

type LemonSqueezyPayload = {
  meta?: {
    event_name?: string;
    custom_data?: {
      user_id?: string;
    };
  };
  data?: {
    id?: string | number;
    attributes?: LemonSqueezyAttributes;
  };
};

// Map LS variant IDs to plan names
function planFromVariantId(variantId: number): "plus" | "pro" | "free" {
  if (variantId === Number(process.env.LEMONSQUEEZY_PLUS_VARIANT_ID))
    return "plus";
  if (variantId === Number(process.env.LEMONSQUEEZY_PRO_VARIANT_ID))
    return "pro";
  return "free";
}

// Map LS subscription status to our sub_status enum
function mapStatus(lsStatus: string): string {
  const map: Record<string, string> = {
    active: "active",
    on_trial: "trialing",
    cancelled: "canceled",
    expired: "canceled",
    past_due: "past_due",
    unpaid: "unpaid",
    paused: "past_due",
  };
  return map[lsStatus] ?? "active";
}

function verifySignature(rawBody: string, signature: string): boolean {
  const hmac = crypto
    .createHmac("sha256", process.env.LEMONSQUEEZY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature") ?? "";

  if (!verifySignature(rawBody, signature)) {
    console.error("[webhook] invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: LemonSqueezyPayload;
  try {
    payload = JSON.parse(rawBody) as LemonSqueezyPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = payload.meta?.event_name;
  const userId = payload.meta?.custom_data?.user_id;
  const attributes = payload.data?.attributes;
  const lsSubId = String(payload.data?.id ?? "");

  if (!eventName || !attributes) {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  console.log(`[webhook] event=${eventName} user=${userId}`);

  try {
    switch (eventName) {
      case "subscription_created": {
        if (!userId) {
          console.error(
            "[webhook] subscription_created missing user_id in custom_data",
          );
          break;
        }

        const plan = planFromVariantId(attributes.variant_id);
        const status = mapStatus(attributes.status);
        const periodEnd = attributes.renews_at ?? null;
        const trialEnd = attributes.trial_ends_at ?? null;
        const portalUrl = attributes.urls?.customer_portal ?? null;
        const customerId = String(attributes.customer_id ?? "");

        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            plan,
            subscription_status: status, // reusing column name for compat
            lemonsqueezy_customer_id: customerId,
            lemonsqueezy_subscription_id: lsSubId,
            customer_portal_url: portalUrl,
            current_period_end: periodEnd,
            trial_ends_at: trialEnd,
            cancel_at_period_end: false,
            has_used_trial: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (error) {
          console.error("[supabase update error]", error);
        }

        console.log(
          `[webhook] subscription created — user=${userId} plan=${plan} status=${status}`,
        );
        break;
      }

      case "subscription_updated": {
        // Find profile by LS subscription ID (user_id not always in updated events)
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("lemonsqueezy_subscription_id", lsSubId)
          .single();

        if (!profile) {
          console.error(
            "[webhook] subscription_updated — no profile found for sub:",
            lsSubId,
          );
          break;
        }

        const plan = planFromVariantId(attributes.variant_id);
        const status = mapStatus(attributes.status);
        const cancelled = attributes.cancelled ?? false;

        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            plan: status === "canceled" ? "free" : plan,
            subscription_status: status,
            current_period_end: attributes.renews_at ?? null,
            trial_ends_at: attributes.trial_ends_at ?? null,
            cancel_at_period_end: cancelled,
            customer_portal_url: attributes.urls?.customer_portal ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id);

        if (error) {
          console.error("[supabase update error 140]", error);
        }

        console.log(
          `[webhook] subscription updated — user=${profile.id} plan=${plan} status=${status} cancelling=${cancelled}`,
        );
        break;
      }

      case "subscription_cancelled":
      case "subscription_expired": {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("lemonsqueezy_subscription_id", lsSubId)
          .single();

        if (!profile) break;

        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            plan: "free",
            subscription_status: "canceled",
            lemonsqueezy_subscription_id: null,
            customer_portal_url: null,
            current_period_end: null,
            trial_ends_at: null,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id);

        console.error("[Supabase update error]", error);

        console.log(
          `[webhook] subscription ended — user=${profile.id} downgraded to free`,
        );
        break;
      }

      case "subscription_payment_failed": {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("lemonsqueezy_subscription_id", lsSubId)
          .single();

        if (!profile) break;

        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id);

        if (error) {
          console.error("[supabase update error 199]", error);
        }

        console.log(`[webhook] payment failed — user=${profile.id}`);
        break;
      }

      default:
        console.log(`[webhook] unhandled event: ${eventName}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[webhook] handler error:", message);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
