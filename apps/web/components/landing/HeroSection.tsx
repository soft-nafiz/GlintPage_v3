import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReaderMockup } from "./ReaderMockup";
import { Stars } from "lucide-react";
import { Safari } from "../ui/safari";

export function HeroSection() {
  return (
    <section className="relative min-h-svh pt-16 flex flex-col items-center text-center  px-5 sm:px-8">
      {/* Background radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 900px 700px at 50% 20%, oklch(0.634 0.108 72 / 0.10) 0%, oklch(0.651 0.059 162 / 0.06) 40%, transparent 70%)",
        }}
      />

      {/* Badge */}
      <div
        className="animate-fade-up mt-24 sm:mt-28"
        style={{ animationDelay: "0.1s" }}
      >
        <Badge>
          <Stars />
          Next-Generation AI Translation
        </Badge>
      </div>

      {/* Headline */}
      <h1
        className="animate-fade-up font-heading font-light text-foreground leading-[0.96] tracking-[-0.02em] mt-10 max-w-4xl"
        style={{
          fontSize: "clamp(52px, 9vw, 108px)",
          animationDelay: "0.2s",
        }}
      >
        Read any book.
        <br />
        <em className="italic text-primary">In your language.</em>
        <br />
        Instantly.
      </h1>

      {/* Subtitle */}
      <p
        className="animate-fade-up font-light text-muted-foreground leading-relaxed mt-7 max-w-lg"
        style={{
          fontSize: "clamp(15px, 2vw, 17px)",
          animationDelay: "0.35s",
        }}
      >
        Glintpage is an AI-powered reader and translator that breaks down
        language barriers, giving you a seamless and immersive reading
        experience.
      </p>

      {/* CTAs */}
      <div
        className="animate-fade-up flex flex-wrap items-center justify-center gap-3 mt-11"
        style={{ animationDelay: "0.5s" }}
      >
        <Button
          asChild
          size="lg"
          className="rounded-full px-8 text-[15px] font-medium"
          style={{
            boxShadow: "0 2px 12px var(--gold-glow)",
          }}
        >
          <Link href="#">Try the MVP</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="rounded-full px-8 text-[15px] font-medium"
        >
          <Link href="#features">How it Works</Link>
        </Button>
      </div>

      {/* Reader mockup */}
      <div
        className="animate-fade-up w-full max-w-5xl mt-16 mb-0"
        style={{ animationDelay: "0.7s" }}
      >
        <Safari
          url="glintpage.com"
          imageSrc="/mockup.png"
          className="h-auto shadow-2xl"
        />
      </div>
    </section>
  );
}
