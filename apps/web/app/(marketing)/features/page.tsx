import CtaSection from "@/components/landing/CtaSection";
import { DemoSection } from "@/components/landing/DemoSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Features",
  description:
    "Explore Glintpage features for AI book translation, chapter summaries, audio reading, private uploads, and distraction-free reading.",
  path: "/features",
  keywords: [
    "Glintpage features",
    "AI book translation features",
    "PDF EPUB reader features",
    "AI reading assistant",
  ],
});

export default function FeaturesPage() {
  return (
    <main className="pt-16">
      <FeaturesSection />
      <DemoSection />
      <CtaSection />
    </main>
  );
}
