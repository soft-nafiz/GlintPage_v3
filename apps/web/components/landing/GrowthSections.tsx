import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RevealWrapper } from "./RevealWrapper";

const TRAPS = [
  "You buy books you genuinely intend to finish, then lose momentum.",
  "The sharpest ideas stay trapped behind languages you do not speak.",
  "You read powerful passages, then forget them before they change behavior.",
  "Your notes, PDFs, EPUBs, and saved books scatter across too many places.",
  "Your reading environment competes with tabs, noise, clutter, and fatigue.",
];

const LOOPS = [
  "Open any supported book or public-domain classic.",
  "Translate difficult passages without leaving the reader.",
  "Summarize chapters into clear, usable wisdom blocks.",
  "Track progress and return to what matters.",
  "Build a calm library where insight keeps accumulating.",
];

const COMPARISONS = [
  {
    spend: "One cafe coffee",
    moment: "20 minutes of comfort",
    return: "A month of translated reading momentum on Plus",
  },
  {
    spend: "One impulse ebook you may not finish",
    moment: "Another title in the pile",
    return: "Summaries that turn unfinished books into usable insight",
  },
  {
    spend: "One streaming add-on",
    moment: "More passive content",
    return: "A calmer system for active cognitive growth",
  },
  {
    spend: "One missed foreign-language book",
    moment: "Zero access",
    return: "A global idea becomes readable tonight",
  },
];

const FREE_LIBRARY_FEATURES = [
  "Read life-improving classics in a calm, premium interface.",
  "Translate passages when the original language gets in the way.",
  "Generate your first AI summary and leave with something useful today.",
  "Save books to your library and build momentum before upgrading.",
];

export function CognitiveAuditSection() {
  return (
    <section className="py-24 sm:py-32 px-5 sm:px-8 lg:px-12 max-w-7xl mx-auto">
      <RevealWrapper>
        <span className="text-xs font-semibold tracking-[0.14em] uppercase text-primary block mb-4">
          The cognitive audit
        </span>
      </RevealWrapper>
      <RevealWrapper delay={80}>
        <div className="max-w-3xl">
          <h2
            className="font-heading font-light tracking-[-0.02em] leading-[1.05]"
            style={{ fontSize: "clamp(34px, 5vw, 58px)" }}
          >
            Your reading life is
            <br />
            <em className="italic text-primary">quietly leaking value.</em>
          </h2>
          <p className="mt-6 text-[15px] sm:text-[16px] font-light leading-relaxed text-muted-foreground">
            The problem is not that you are not curious. It is that modern
            reading is full of tiny fallbacks that interrupt growth before it
            compounds.
          </p>
        </div>
      </RevealWrapper>

      <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <AuditCard
          title="Stagnant Reading Trap"
          items={TRAPS}
          icon="negative"
          delay={120}
        />
        <AuditCard
          title="Compounding Growth Loop"
          items={LOOPS}
          icon="positive"
          delay={200}
        />
      </div>

      <RevealWrapper delay={260}>
        <div className="mt-10">
          <Button asChild>
            <Link href="/auth/sign-up">Repair Your Reading Loop</Link>
          </Button>
        </div>
      </RevealWrapper>
    </section>
  );
}

function AuditCard({
  title,
  items,
  icon,
  delay,
}: {
  title: string;
  items: string[];
  icon: "negative" | "positive";
  delay: number;
}) {
  const Icon = icon === "positive" ? Check : X;

  return (
    <RevealWrapper delay={delay}>
      <Card className="h-full rounded-2xl border-foreground/10 bg-card/70 p-0">
        <CardContent className="p-6 sm:p-8">
          <h3 className="font-heading text-2xl text-foreground">{title}</h3>
          <ul className="mt-7 space-y-4">
            {items.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-relaxed">
                <span
                  className={
                    icon === "positive"
                      ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
                      : "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/8 text-muted-foreground"
                  }
                >
                  <Icon size={13} strokeWidth={2.4} />
                </span>
                <span className="font-light text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </RevealWrapper>
  );
}

export function InvestmentFrameworkSection() {
  return (
    <section
      className="py-24 sm:py-32 px-5 sm:px-8"
      style={{ background: "var(--paper-dim)" }}
    >
      <div className="max-w-7xl mx-auto">
        <RevealWrapper>
          <span className="text-xs font-semibold tracking-[0.14em] uppercase text-primary block mb-4">
            The investment framework
          </span>
        </RevealWrapper>
        <RevealWrapper delay={80}>
          <div className="max-w-3xl">
            <h2
              className="font-heading font-light tracking-[-0.02em] leading-[1.05]"
              style={{ fontSize: "clamp(34px, 5vw, 58px)" }}
            >
              Less than a tiny habit.
              <br />
              <em className="italic text-primary">More than a tiny upgrade.</em>
            </h2>
            <p className="mt-6 text-[15px] sm:text-[16px] font-light leading-relaxed text-muted-foreground">
              Glintpage is not another subscription asking for attention. It is
              a small monthly investment in clearer thinking, wider access, and
              a more intentional intellectual life.
            </p>
          </div>
        </RevealWrapper>

        <RevealWrapper delay={140}>
          <Card className="mt-12 overflow-hidden rounded-2xl border-foreground/10 bg-card p-0">
            <CardContent className="p-0">
              <div className="border-b border-foreground/10 p-6 sm:p-8">
                <h3 className="font-heading text-2xl">
                  What could one month of Glintpage unlock?
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-secondary/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Everyday spend</th>
                      <th className="px-6 py-4 font-semibold">
                        Momentary return
                      </th>
                      <th className="px-6 py-4 font-semibold">
                        Glintpage return
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISONS.map((row) => (
                      <tr key={row.spend} className="border-t border-foreground/8">
                        <td className="px-6 py-5 font-medium text-foreground">
                          {row.spend}
                        </td>
                        <td className="px-6 py-5 text-muted-foreground">
                          {row.moment}
                        </td>
                        <td className="px-6 py-5 text-foreground">
                          {row.return}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </RevealWrapper>

        <RevealWrapper delay={220}>
          <div className="mt-10 max-w-3xl">
            <p className="font-heading text-2xl font-light leading-relaxed text-foreground">
              The real cost is not the monthly price. It is the business book
              you never accessed, the insight you forgot, the classic you
              postponed, and the mental clarity you kept outsourcing to later.
            </p>
            <Button asChild className="mt-8">
              <Link href="/auth/sign-up">Invest in Your Reading Life</Link>
            </Button>
          </div>
        </RevealWrapper>
      </div>
    </section>
  );
}

export function FreeLibrarySection() {
  return (
    <section className="py-24 sm:py-32 px-5 sm:px-8 lg:px-12 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <RevealWrapper>
          <div>
            <span className="text-xs font-semibold tracking-[0.14em] uppercase text-primary block mb-4">
              The seed of progress
            </span>
            <h2
              className="font-heading font-light tracking-[-0.02em] leading-[1.05]"
              style={{ fontSize: "clamp(34px, 5vw, 58px)" }}
            >
              Start with a free library
              <br />
              <em className="italic text-primary">that already wants you to grow.</em>
            </h2>
            <p className="mt-6 text-[15px] sm:text-[16px] font-light leading-relaxed text-muted-foreground">
              Glintpage includes a curated collection of public-domain classics
              and personal-growth titles you can begin reading without paying
              first.
            </p>
          </div>
        </RevealWrapper>

        <RevealWrapper delay={120}>
          <Card className="rounded-2xl border-foreground/10 bg-card/70 p-0">
            <CardContent className="p-6 sm:p-8">
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {FREE_LIBRARY_FEATURES.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm leading-relaxed">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Check size={13} strokeWidth={2.4} />
                    </span>
                    <span className="font-light text-muted-foreground">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 rounded-xl border border-primary/20 bg-primary/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                  Your first win
                </p>
                <p className="mt-3 text-sm font-light leading-relaxed text-foreground">
                  Create a free account, open a classic, translate a difficult
                  passage, and capture the chapter&apos;s core insight before your
                  next reading session ends.
                </p>
              </div>

              <Button asChild className="mt-8 w-full sm:w-fit">
                <Link href="/library">
                  Read Your First Free Summary
                  <ArrowRight size={16} />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </RevealWrapper>
      </div>
    </section>
  );
}
