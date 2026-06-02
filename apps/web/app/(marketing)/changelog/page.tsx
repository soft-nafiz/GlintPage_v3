import { Metadata } from "next";

export const metadata: Metadata = {
  title: "MVP Changelog | Glintpage",
  description:
    "Track the latest updates and improvements to the Glintpage platform.",
};

const updates = [
  {
    version: "v1.0.0 (MVP Launch)",
    date: "June 2026",
    type: "Major Release",
    changes: [
      "Launched the core distraction-free reading interface.",
      "Integrated publication-grade AI translation engine.",
      "Added personal vault for private EPUB/PDF uploads.",
      "Deployed initial public library collection.",
    ],
  },
  {
    version: "v0.9.5 (Beta)",
    date: "May 2026",
    type: "Improvement",
    changes: [
      "Refined typography controls (serif/sans-serif scaling).",
      "Fixed a bug causing layout shifts on mobile viewports.",
      "Optimized document intake speed by 40%.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-24 sm:py-32">
      <div className="mb-16">
        <h1 className="text-4xl font-heading font-light tracking-tight mb-4 text-foreground">
          MVP Changelog
        </h1>
        <p className="text-muted-foreground text-lg">
          Follow our journey as we continuously refine and expand the Glintpage
          ecosystem.
        </p>
      </div>

      <div className="space-y-12">
        {updates.map((update, idx) => (
          <div key={idx} className="relative pl-8 border-l border-border">
            <div className="absolute w-3 h-3 bg-primary rounded-full -left-[6.5px] top-2 shadow-[0_0_0_4px_var(--background)]" />
            <div className="mb-2 flex items-baseline gap-3">
              <h2 className="text-xl font-medium text-foreground">
                {update.version}
              </h2>
              <span className="text-sm text-muted-foreground">
                {update.date}
              </span>
            </div>
            <span className="inline-block px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium mb-4">
              {update.type}
            </span>
            <ul className="space-y-2 text-muted-foreground">
              {update.changes.map((change, i) => (
                <li key={i} className="flex gap-2 items-start">
                  <span className="text-primary mt-1">✦</span>
                  <span className="leading-relaxed">{change}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
