import React from "react";
import { Button } from "../ui/button";

const CtaSection = () => {
  return (
    <section className="bg-foreground text-background text-center py-28 px-6 md:py-36 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-[radial-gradient(ellipse,rgba(184,146,74,0.12)_0%,transparent_65%)] pointer-events-none" />
      <p className="text-primary uppercase m-6 text-sm">Get Started</p>
      <h2 className="font-heading text-6xl md:text-7xl mb-10 md:mb-12 ">
        Ready to open
        <br />a <em className="text-primary italic">new chapter?</em>
      </h2>
      <Button>Create your free account</Button>
      <p className="text-sm mt-6 text-accent">
        No credit card required. Setup takes 30 seconds.
      </p>
    </section>
  );
};

export default CtaSection;
