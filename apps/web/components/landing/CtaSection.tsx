import Link from "next/link";
import { Button } from "../ui/button";

const CtaSection = () => {
  return (
    <section className="bg-foreground text-background text-center py-28 px-6 md:py-36 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-[radial-gradient(ellipse,rgba(184,146,74,0.12)_0%,transparent_65%)] pointer-events-none" />
      <p className="text-primary uppercase m-6 text-sm tracking-[0.14em]">
        Begin your cognitive investment
      </p>
      <h2 className="font-heading text-5xl md:text-7xl mb-8 md:mb-10 leading-[1.05]">
        Your next chapter can be
        <br />
        <em className="text-primary italic">harder to forget.</em>
      </h2>
      <p className="mx-auto mb-10 max-w-2xl text-sm md:text-base font-light leading-relaxed text-background/70">
        Make it easier to start, easier to understand, and easier to carry into
        the life you are building.
      </p>
      <Button asChild>
        <Link href="/auth/sign-up">Begin Your Cognitive Investment</Link>
      </Button>
      <p className="text-sm mt-6 text-accent">
        No credit card required. Setup takes 30 seconds.
      </p>
    </section>
  );
};

export default CtaSection;
