"use client";

import { useTransition } from "react";
import {
  createCheckoutSession,
  createPortalSession,
} from "@/lib/actions/billing";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type Profile = {
  plan: string;
  subscription_status: string | null;
  trial_ends_at: string | null;
  has_used_trial: boolean;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

const PLANS = [
  {
    id: "free",
    name: "Free Account",
    price: "$0",
    period: "forever",
    description: "For beginning the habit.",

    featured: false,
    features: [
      "About 5 average translated pages / day",
      "About 1 average chapter summary / day",
      "Up to 10 minutes of AI audio per day",
      "Public library access",
    ],
  },
  {
    id: "plus",
    name: "Plus Tier",
    price: "$5.99",
    period: "/ month",
    description: "For everyday readers and language learners",

    featured: true,
    features: [
      "About 35 average translated pages / day",
      "About 10 average chapter summaries / day",
      "Up to 60 minutes of AI audio per day",
      "Audiobook mode",
      "Smart prefetch",

    ],
  },
  {
    id: "pro",
    name: "Pro Account",
    price: "$14.99",
    period: "/ month",
    description: "For power readers, researchers, and serious self-educators",

    featured: false,
    features: [
      "About 90 average translated pages / day",
      "About 30 average chapter summaries / day",
      "No audio limit",
      "Priority AI routing",
      "Early access to new features and premium themes",
      "Everything in Plus",
    ],
  },
] as const;

function PlanCard({
  plan,
  currentPlan,
  cancelAtPeriodEnd,
  currentPeriodEnd,
  isAuthenticated,
}: {
  plan: (typeof PLANS)[number];
  currentPlan: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  isAuthenticated: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const isCurrentPlan = isAuthenticated && plan.id === currentPlan;

  const isCanceling = isCurrentPlan && cancelAtPeriodEnd;

  function handleCTA() {
    startTransition(async () => {
      const hasPaidSubscription =
        currentPlan !== "free";

      if (!isAuthenticated && plan.id === "free") {
        window.location.href = "/auth/sign-up";
        return;
      }

      if (isCurrentPlan || plan.id === "free" || hasPaidSubscription) {
        await createPortalSession();
      } else {
        await createCheckoutSession(plan.id as "plus" | "pro");
      }
    });
  }

  function getCTALabel() {
    if (isPending) return null;

    if (!isAuthenticated) {
      if (plan.id === "free") return "Create Free Account";
      if (plan.id === "plus") return "Begin Plus Growth";
      if (plan.id === "pro") return "Invest in Pro";
    }

    // 1. Logic for the user's CURRENT active plan card
    if (isCurrentPlan) {
      if (plan.id === "free") return "Current Plan";
      if (isCanceling) return "Reactivate";
      return "Manage Plan";
    }

    // 2. Logic for browsing OTHER plan cards
    if (plan.id === "free") {
      return "Downgrade";
    }

    if (plan.id === "plus") {
      return currentPlan === "free" ? "Begin Plus Growth" : "Select Plan";
    }

    if (plan.id === "pro") {
      return "Invest in Pro";
    }

    return "Select Plan";
  }

  return (
    <Card
      className={cn(
        "relative p-6 transition-shadow hover:shadow-md overflow-visible",

        plan.featured &&
          "ring-2 ring-primary ring-offset-2 bg-primary text-background",
      )}
    >
      {/* Most popular badge */}
      {plan.featured && (
        <Badge className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 border border-border shadow-2xl">
          Most popular
        </Badge>
      )}

      {/* Current plan badge */}
      {isCurrentPlan && (
        <div className="absolute top-4 right-4">
          <Badge variant="secondary" className="text-[10px] font-semibold">
            Current
          </Badge>
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <div className={cn("w-10 h-10  mb-3")}></div>

        <h3
          className={cn(
            "text-2xl font-bold text-foreground font-heading",
            plan.featured && "text-background",
          )}
        >
          {plan.name}
        </h3>
        <p
          className={cn(
            "text-sm text-muted-foreground mt-0.5",
            plan.featured && "text-primary-foreground/65",
          )}
        >
          {plan.description}
        </p>

        <div className="flex items-baseline gap-1 mt-4">
          <span
            className={cn(
              "text-5xl font-bold text-foreground font-heading",
              plan.featured && "text-primary-foreground",
            )}
          >
            {plan.price}
          </span>
          <span
            className={cn(
              "text-sm text-muted-foreground",
              plan.featured && "text-primary-foreground/65",
            )}
          >
            {plan.period}
          </span>
        </div>
      </div>

      {/* CTA */}
      <Button
        onClick={handleCTA}
        variant="outline"
        disabled={isPending || (isCurrentPlan && plan.id === "free")}
        className={cn(
          " mb-5 cursor-pointer",
          isCurrentPlan && !isCanceling
            ? "bg-gray-100 text-foreground cursor-default"
            : "",
          isPending && "opacity-70 cursor-wait",

          plan.featured &&
            "bg-gold-light hover:bg-gold-light/80 hover:text-primary-foreground",
        )}
      >
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        {getCTALabel()}
      </Button>

      {/* Canceling notice */}
      {isCanceling && currentPeriodEnd && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4 text-center">
          Cancels on{" "}
          {new Date(currentPeriodEnd).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          })}
        </p>
      )}

      {/* Features */}
      <ul className="space-y-2.5">
        {plan.features.map((f) => (
          <li
            key={f}
            className={cn(
              "flex items-start gap-2.5 text-sm text-muted-foreground",
              plan.featured && "text-primary-foreground/65",
            )}
          >
            <Check className={cn("w-4 h-4 mt-0.5 shrink-0")} />
            {f}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PricingClient({
  profile,
  showSuccess,
  showCanceled,
}: {
  profile: Profile | null;
  showSuccess: boolean;
  showCanceled: boolean;
}) {
  const isAuthenticated = !!profile;
  return (
    <main
      className="py-24 sm:py-32 px-5 sm:px-8 lg:px-12 max-w-7xl mx-auto"
      id="pricing"
    >
      {/* Toast banners */}
      {showSuccess && (
        <div className="bg-paper-dim border border-border text-primary rounded-xl px-4 py-3 text-sm font-medium mb-6 flex items-center gap-2">
          <Check size={18} /> Subscription activated - enjoy your reading!
        </div>
      )}
      {showCanceled && (
        <div className="bg-gray-100 border border-gray-200 text-gray-600 rounded-xl px-4 py-3 text-sm mb-6">
          Checkout canceled - you haven&apos;t been charged.
        </div>
      )}

      {/* Pricing cards */}
      <section>
        <span className="text-xs font-semibold tracking-[0.14em] uppercase text-primary block mb-4">
          Choose Your Growth Velocity
        </span>
        <div className="max-w-3xl mb-14">
          <h2
            className="font-heading font-light tracking-[-0.02em] leading-[1.05]"
            style={{ fontSize: "clamp(34px, 5vw, 58px)" }}
          >
            How fast do you want your
            <br />
            <em className="italic text-primary">reading life to compound?</em>
          </h2>
          <p className="mt-6 text-[15px] sm:text-[16px] font-light leading-relaxed text-muted-foreground">
            Begin free, then upgrade when translation, summaries, audio, and
            focus become part of your daily growth ritual.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              currentPlan={profile?.plan || "none"}
              cancelAtPeriodEnd={profile?.cancel_at_period_end || false}
              currentPeriodEnd={profile?.current_period_end || null}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className=" pt-10">
        <Accordion type="multiple" className="w-full">
          {[
            [
              "Will I be charged when I upgrade?",
              "Yes. Plus and Pro are paid plans with no free trial. You can cancel anytime from the customer portal.",
            ],
            [
              "What happens when I hit my daily limit?",
              "You can keep reading in the original language. Daily AI token limits reset every midnight UTC.",
            ],
            [
              "Can I switch plans?",
              "Yes - use the Manage button to upgrade, downgrade, or cancel through the customer portal.",
            ],
          ].map(([q, a]) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger>{q}</AccordionTrigger>
              <AccordionContent>{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </main>
  );
}
