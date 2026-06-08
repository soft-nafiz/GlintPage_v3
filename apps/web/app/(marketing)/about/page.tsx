import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us | Glintpage",
  description: "Our mission to break language barriers in literature.",
};

export default function AboutPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-24 sm:py-32">
      <h1 className="text-4xl font-heading font-light tracking-tight mb-8 text-foreground">
        About <span className="text-primary font-medium">Glintpage</span>
      </h1>

      <div className="space-y-8 text-lg text-muted-foreground font-light leading-relaxed">
        <p>
          Literature is a global inheritance, yet much of it remains locked
          behind language barriers. Glintpage was built on a simple premise: a
          great book should be readable by anyone, anywhere, without losing the
          author&apos;s original voice.
        </p>
        <p>
          We are building the ultimate sanctuary for the literary-minded. By
          combining a deeply customizable, distraction-free reading environment
          with publication-grade AI translation, we are giving readers the power
          to consume global knowledge seamlessly.
        </p>
        <div className="p-6 bg-secondary/50 border border-border rounded-2xl mt-8">
          <h3 className="text-foreground font-medium mb-2">Our Mission</h3>
          <p className="text-sm">
            To eliminate linguistic friction in reading and provide a premium,
            accessible ecosystem for both personal and public libraries.
          </p>
        </div>
      </div>
    </main>
  );
}
