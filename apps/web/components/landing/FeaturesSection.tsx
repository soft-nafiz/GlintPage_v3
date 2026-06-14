import Link from "next/link";
import { BookOpen, BrainCircuit, GalleryVerticalEnd, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RevealWrapper } from "./RevealWrapper";

const MECHANISMS = [
  {
    title: "The Global Passport",
    icon: Globe2,
    description:
      "Read beyond your native shelf. Translate pages and passages across languages with AI that preserves meaning, context, and tone, so untranslated ideas no longer sit outside your reach.",
  },
  {
    title: "The Retention Engine",
    icon: BrainCircuit,
    description:
      "Turn chapters into actionable wisdom blocks. Smart summaries help you separate signal from filler, revisit the core argument, and carry the insight forward instead of letting it disappear.",
  },
  {
    title: "The Personal Sanctuary",
    icon: GalleryVerticalEnd,
    description:
      "Bring your books, public classics, reading progress, themes, and AI tools into one clean, distraction-free reader. Less clutter. Fewer abandoned tabs. More pages actually finished.",
  },
];

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="py-24 sm:py-32 px-5 sm:px-8 lg:px-12 max-w-7xl mx-auto"
    >
      <RevealWrapper>
        <span className="text-xs font-semibold tracking-[0.14em] uppercase text-primary block mb-4">
          How Glintpage makes you smarter
        </span>
      </RevealWrapper>
      <RevealWrapper delay={80}>
        <div className="max-w-3xl">
          <h2
            className="font-heading font-light tracking-[-0.02em] leading-[1.05]"
            style={{ fontSize: "clamp(34px, 5vw, 58px)" }}
          >
            Three mechanisms.
            <br />
            <em className="italic text-primary">One calmer mind.</em>
          </h2>
          <p className="mt-6 text-[15px] sm:text-[16px] font-light leading-relaxed text-muted-foreground">
            Glintpage blends robust AI features with a beautiful reader so
            learning feels less like managing software and more like returning
            to a private study.
          </p>
        </div>
      </RevealWrapper>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-5 mt-14 items-stretch">
        <div className="grid grid-cols-1 gap-5">
          {MECHANISMS.map((mechanism, index) => {
            const Icon = mechanism.icon;

            return (
              <RevealWrapper key={mechanism.title} delay={120 + index * 70}>
                <Card className="h-full rounded-2xl border-foreground/10 bg-card/70 p-0">
                  <CardContent className="p-6 sm:p-7">
                    <div className="flex items-start gap-4">
                      <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                        <Icon size={21} />
                      </span>
                      <div>
                        <h3 className="font-heading text-xl text-foreground">
                          {mechanism.title}
                        </h3>
                        <p className="mt-2 text-sm font-light leading-relaxed text-muted-foreground">
                          {mechanism.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </RevealWrapper>
            );
          })}
        </div>

        <RevealWrapper delay={200}>
          <Card className="h-full overflow-hidden rounded-2xl border-foreground/10 bg-foreground p-0 text-background">
            <CardContent className="flex h-full flex-col justify-between p-6 sm:p-8">
              <div>
                <div className="flex items-center justify-between border-b border-background/10 pb-4 text-xs text-background/55">
                  <span className="flex items-center gap-2 font-medium tracking-[0.12em] uppercase">
                    <BookOpen size={15} />
                    Distraction-free reader
                  </span>
                  <span>Chapter insight</span>
                </div>
                <div className="py-10 sm:py-14">
                  <p className="font-heading text-2xl leading-[1.7] sm:text-3xl">
                    &quot;The right book does not merely inform you. It
                    rearranges what you notice next.&quot;
                  </p>
                  <div className="mt-8 rounded-xl border border-background/10 bg-background/5 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                      AI summary block
                    </p>
                    <p className="mt-3 text-sm font-light leading-relaxed text-background/70">
                      Key idea captured, translated, and ready to revisit before
                      the insight fades.
                    </p>
                  </div>
                </div>
              </div>

              <Button asChild className="w-full sm:w-fit">
                <Link href="/library">See the Reader in Action</Link>
              </Button>
            </CardContent>
          </Card>
        </RevealWrapper>
      </div>
    </section>
  );
}
