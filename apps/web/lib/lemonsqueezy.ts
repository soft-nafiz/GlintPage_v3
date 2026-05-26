import { lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";

lemonSqueezySetup({
  apiKey: process.env.LEMONSQUEEZY_API_KEY!,
  onError: (error) => console.error("[lemonsqueezy]", error),
});

export const VARIANT_IDS = {
  plus: Number(process.env.LEMONSQUEEZY_PLUS_VARIANT_ID!),
  pro: Number(process.env.LEMONSQUEEZY_PRO_VARIANT_ID!),
} as const;

export const STORE_ID = Number(process.env.LEMONSQUEEZY_STORE_ID!);
