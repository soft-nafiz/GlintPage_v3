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
    name: "Starter",
    price: "$0",
    period: "forever",
    description: "Get a taste of AI-powered reading",

    featured: false,
    features: [
      "Translate 3 pages / day",
      "Summarize 1 chapter / day",
      "Public library access",
      "Basic reader with 2 themes",
    ],
  },
  {
    id: "plus",
    name: "Standard",
    price: "$5.99",
    period: "/ month",
    description: "For everyday readers and language learners",

    featured: true,
    trial: "7-day free trial",
    features: [
      "Translate 30 pages / day",
      "Summarize 10 chapters / day",
      "Listen 5 minutes audio / day",
      "Smart Prefetch",
      "Multi-device sync",
      "Cancel anytime",
    ],
  },
  {
    id: "pro",
    name: "Premium",
    price: "$14.99",
    period: "/ month",
    description: "For power readers and researchers",

    featured: false,
    features: [
      "Translate 70 pages / day",
      "Summarize 30 pages / day",
      "Listen 15 minutes audio / day",
      "Priority AI routing",
      "Early access to new features and premium themes",
      "Everything in Plus",
      "Cancel anytime",
    ],
  },
] as const;

function PlanCard({
  plan,
  currentPlan,
  cancelAtPeriodEnd,
  trialEndsAt,
  hasUsedTrial,
  currentPeriodEnd,
  isAuthenticated,
}: {
  plan: (typeof PLANS)[number];
  currentPlan: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  hasUsedTrial: boolean;
  currentPeriodEnd: string | null;
  isAuthenticated: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const isCurrentPlan =
    isAuthenticated &&
    (plan.id === currentPlan ||
      (plan.id === "plus" && currentPlan === "trial"));

  const isCanceling = isCurrentPlan && cancelAtPeriodEnd;

  function handleCTA() {
    startTransition(async () => {
      const hasPaidSubscription =
        currentPlan !== "free" && currentPlan !== "trial";

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
      return plan.id === "free" ? "Get Started" : "Select Plan";
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
      return currentPlan === "free" ? "Upgrade to Plus" : "Select Plan";
    }

    if (plan.id === "pro") {
      return "Upgrade to Pro";
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
            {currentPlan === "trial" ? "Trial" : "Current"}
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

        {"trial" in plan && plan.trial && !isCurrentPlan && !hasUsedTrial && (
          <p className="text-xs text-primary-foreground font-medium mt-1">
            {plan.trial} - no charge until day 8
          </p>
        )}
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

      {/* Trial notice */}
      {isCurrentPlan && currentPlan === "trial" && trialEndsAt && (
        <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2 mb-4 text-center">
          Trial ends{" "}
          {new Date(trialEndsAt).toLocaleDateString("en-US", {
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
          Simple Pricing
        </span>
        <h2
          className="font-heading font-light tracking-[-0.02em] leading-[1.05] mb-14"
          style={{ fontSize: "clamp(34px, 5vw, 58px)" }}
        >
          Choose your reading
          <br />
          <em className="italic text-primary">experience.</em>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              currentPlan={profile?.plan || "none"}
              cancelAtPeriodEnd={profile?.cancel_at_period_end || false}
              trialEndsAt={profile?.trial_ends_at || null}
              hasUsedTrial={profile?.has_used_trial || false}
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
              "Will I be charged during the trial?",
              "No - your card is saved but not charged until day 8. Cancel anytime before that for free.",
            ],
            [
              "What happens when I hit my daily limit?",
              "You can keep reading in the original language. Limits reset every midnight UTC.",
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
