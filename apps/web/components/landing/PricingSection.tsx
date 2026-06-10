import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RevealWrapper } from "./RevealWrapper";
import { cn } from "@/lib/utils";

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  cta: string;
  featured?: boolean;
  note?: string;
}

const PLANS: PricingPlan[] = [
  {
    name: "Plus",
    price: "$4.99",
    period: "/ month",
    tagline:
      "Ideal for avid everyday readers, casual language learners, and book lovers.",
    features: [
      "About 30 Average Translated Pages / Day",
      "About 10 Average Chapter Summaries / Day",
      "5 Mins of Premium AI Audio",
      "Full Reader UI Customization",
      "Seamless Cross-Device Syncing",
    ],
    cta: "Start 7-Day Free Trial",
    featured: true,
    note: "Then $4.99/mo. Cancel anytime.",
  },
  {
    name: "Pro",
    price: "$29",
    period: "/ month",
    tagline:
      "Built for power readers, research professionals, and academic students.",
    features: [
      "About 70 Average Translated Pages / Day",
      "About 30 Average Chapter Summaries / Day",
      "15 Mins of Premium AI Audio",
      "Priority Server & AI Model Routing",
      "Early Access to Features",
    ],
    cta: "Upgrade to Pro",
    note: "Instant access to maximum daily limits.",
  },
];

function PricingCard({ plan, delay }: { plan: PricingPlan; delay: number }) {
  const { featured } = plan;
  const { note } = plan;

  return (
    <RevealWrapper delay={delay}>
      <Card
        className={cn(
          "relative h-full rounded-2xl p-0 border overflow-visible",
          featured ? "border-transparent " : "border-foreground/08 bg-card",
        )}
        style={
          featured
            ? {
                background: "var(--ink)",
                boxShadow: "0 8px 32px oklch(0.101 0.005 265 / 0.18)",
              }
            : undefined
        }
      >
        {featured && (
          <div className="absolute -top-[10px] left-1/2 -translate-x-1/2 z-10">
            <Badge
              className="rounded-full px-5 py-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase bg-primary text-primary-foreground border-0"
              style={{ boxShadow: "0 4px 12px oklch(0.634 0.108 72 / 0.3)" }}
            >
              Most Popular
            </Badge>
          </div>
        )}

        <CardContent className="p-8 sm:p-10 flex flex-col h-full">
          {/* Plan name */}
          <p
            className="text-[13px] font-semibold tracking-[0.1em] uppercase mb-3"
            style={{ color: featured ? "var(--gold-light)" : "var(--gold)" }}
          >
            {plan.name}
          </p>

          {/* Price */}
          <div className="mb-1">
            <span
              className="font-heading font-light tracking-[-0.03em] leading-none"
              style={{
                fontSize: "clamp(40px, 6vw, 52px)",
                color: featured ? "var(--paper)" : "var(--ink)",
              }}
            >
              <sup
                className="font-sans font-normal align-top mt-2 inline-block"
                style={{ fontSize: "22px" }}
              >
                {plan.price === "$0" ? "" : "$"}
              </sup>
              {plan.price.replace("$", "")}
            </span>
          </div>

          <p
            className="text-[13px] font-light mb-5"
            style={{
              color: featured
                ? "oklch(0.963 0.014 85 / 0.45)"
                : "var(--ink-40)",
            }}
          >
            {plan.period}
          </p>

          {/* Tagline */}
          <p
            className="text-[14px] font-light leading-relaxed mb-8 pb-8 border-b"
            style={{
              color: featured ? "oklch(0.963 0.014 85 / 0.5)" : "var(--ink-60)",
              borderColor: featured ? "oklch(1 0 0 / 0.10)" : "var(--ink-08)",
            }}
          >
            {plan.tagline}
          </p>

          {/* Features list */}
          <ul className="flex flex-col gap-3.5 flex-1 mb-10">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <span
                  className="w-[18px] h-[18px] rounded-full shrink-0 flex items-center justify-center mt-px"
                  style={{
                    background: featured
                      ? "oklch(0.634 0.108 72 / 0.2)"
                      : "var(--gold-glow)",
                    border: "1px solid oklch(0.634 0.108 72 / 0.3)",
                  }}
                >
                  <Check
                    size={10}
                    strokeWidth={2.5}
                    style={{ color: "var(--gold)" }}
                  />
                </span>
                <span
                  className="text-[14px] font-light leading-snug"
                  style={{
                    color: featured
                      ? "oklch(0.963 0.014 85 / 0.75)"
                      : "var(--ink-80)",
                  }}
                >
                  {f}
                </span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          {featured ? (
            <Button className="w-full cursor-pointer">{plan.cta}</Button>
          ) : (
            <Button variant="outline" className="w-full cursor-pointer">
              {plan.cta}
            </Button>
          )}
          {note ? (
            <p
              className={`text-xs text-center tracking-wider uppercase mt-6 text-muted-foreground ${featured ? "text-background/0.5 font-semibold" : ""}`}
            >
              {plan.note}
            </p>
          ) : (
            ""
          )}
        </CardContent>
      </Card>
    </RevealWrapper>
  );
}

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="py-24 sm:py-32 px-5 sm:px-8 lg:px-12 max-w-7xl mx-auto"
    >
      <RevealWrapper>
        <span className="text-xs font-semibold tracking-[0.14em] uppercase text-primary block mb-4">
          Simple Pricing
        </span>
      </RevealWrapper>
      <RevealWrapper delay={80}>
        <h2
          className="font-heading font-light tracking-[-0.02em] leading-[1.05] mb-14"
          style={{ fontSize: "clamp(34px, 5vw, 58px)" }}
        >
          Choose your reading
          <br />
          <em className="italic text-primary">experience.</em>
        </h2>
      </RevealWrapper>

      <div className="grid grid-cols-1 sm:grid-cols-2  gap-4 items-start">
        {PLANS.map((plan, i) => (
          <PricingCard key={plan.name} plan={plan} delay={i * 100} />
        ))}
      </div>
    </section>
  );
}
