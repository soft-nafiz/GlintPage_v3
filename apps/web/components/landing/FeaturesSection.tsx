import {
  BookOpen,
  Globe,
  Notebook,
  Palette,
  ShieldCheckIcon,
  Stars,
} from "lucide-react";
import { RevealWrapper } from "./RevealWrapper";
import { Card, CardContent } from "@/components/ui/card";

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="py-24 sm:py-32 px-5 sm:px-8 lg:px-12 max-w-7xl mx-auto"
    >
      {/* Dynamic Keyframes Injection for Interactive Visual Animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes float-slow { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes wave-jump { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
        @keyframes line-pulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.6; } }
        .animate-float { animation: float-slow 4s ease-in-out infinite; }
        .animate-wave { animation: wave-jump 1.2s ease-in-out infinite; }
        .animate-line { animation: line-pulse 2s ease-in-out infinite; }
      `,
        }}
      />

      {/* Header Block */}
      <RevealWrapper>
        <span className="text-xs font-semibold tracking-[0.14em] uppercase text-primary block mb-4">
          Platform Ecosystem
        </span>
      </RevealWrapper>
      <RevealWrapper delay={80}>
        <h2
          className="font-heading font-light tracking-[-0.02em] leading-[1.05] mb-16 text-neutral-900 dark:text-neutral-50"
          style={{ fontSize: "clamp(34px, 5vw, 58px)" }}
        >
          A complete workspace for
          <br />
          intentional{" "}
          <em className="italic text-primary">literary immersion.</em>
        </h2>
      </RevealWrapper>

      {/* ── 5-Card Bento Grid Matrix (Replicating layout from image_4b1b4b.png) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* ── CARD 1: Private Vault (Top Left - Row 1, Col 1) ── */}
        <RevealWrapper delay={100}>
          <Card className="rounded-[1.5rem] border border-neutral-200/60 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-0 h-full flex flex-col justify-between overflow-hidden group">
            <CardContent className="p-7 sm:p-8 flex flex-col h-full justify-between min-h-[380px]">
              {/* Animated Shield Illustration Container */}
              <div className="h-40 w-full relative flex items-center justify-center bg-neutral-100/40 dark:bg-neutral-950/40 rounded-xl border border-neutral-200/30 dark:border-neutral-800/50 overflow-hidden mb-6">
                <div className="absolute inset-0 opacity-[0.1] dark:opacity-[0.01] font-mono text-[9px] truncate p-2 select-none pointer-events-none leading-none">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="tracking-widest">
                      01010100 01010010 01000001 01001110 01010011 01001100
                    </div>
                  ))}
                </div>
                <div className="animate-float z-10 w-16 h-16 rounded-xl flex items-center justify-center shadow-xl border text-gold border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-2xl">
                  <ShieldCheckIcon />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                  Your Personal Vault
                </h3>
                <p className="text-sm font-light leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Upload your personal files or book files safely. All custom
                  entries are completely encrypted, private, and visible only to
                  you.
                </p>
              </div>
            </CardContent>
          </Card>
        </RevealWrapper>

        {/* ── CARD 2: AI Summarization (Top Center - Row 1, Col 2) ── */}
        <RevealWrapper delay={150}>
          <Card className="rounded-[1.5rem] border border-neutral-200/60 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-0 h-full flex flex-col justify-between overflow-hidden">
            <CardContent className="p-7 sm:p-8 flex flex-col h-full justify-between min-h-[380px]">
              {/* Sequential Processing Loading List Animation */}
              <div className="h-40 w-full p-4 flex flex-col justify-center bg-neutral-100/40 dark:bg-neutral-950/40 rounded-xl border border-neutral-200/30 dark:border-neutral-800/50 text-[11px] font-sans gap-2 mb-6">
                <div className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span>Condensing core architecture...</span>
                </div>
                <div className="space-y-1.5 opacity-80 pl-3.5 border-l border-neutral-200 dark:border-neutral-800">
                  <div className="text-neutral-500">
                    1. Analyzing structural text layers
                  </div>
                  <div className="text-neutral-500">
                    2. Mapping conceptual highlights
                  </div>
                  <div className="text-primary font-medium">
                    3. Building executive summary block
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                  Smart Summarization
                </h3>
                <p className="text-sm font-light leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Condense complex subplots, chapters, or arguments instantly.
                  Get precise overviews without losing context or narrative
                  logic.
                </p>
              </div>
            </CardContent>
          </Card>
        </RevealWrapper>

        {/* ── CARD 3: Public Library (Top Right - Row 1, Col 3) ── */}
        <RevealWrapper delay={200}>
          <Card className="rounded-[1.5rem] border border-neutral-200/60 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-0 h-full flex flex-col justify-between overflow-hidden">
            <CardContent className="p-7 sm:p-8 flex flex-col h-full justify-between min-h-[380px]">
              {/* Connected Hub Interfacing Diagram */}
              <div className="h-40 w-full relative flex items-center justify-center bg-neutral-100/40 dark:bg-neutral-950/40 rounded-xl border border-neutral-200/30 dark:border-neutral-800/50 mb-6">
                <svg
                  className="absolute inset-0 w-full h-full stroke-neutral-200 dark:stroke-neutral-800/60"
                  fill="none"
                >
                  <line
                    x1="50%"
                    y1="50%"
                    x2="25%"
                    y2="30%"
                    className="animate-line"
                  />
                  <line
                    x1="50%"
                    y1="50%"
                    x2="75%"
                    y2="25%"
                    className="animate-line"
                    style={{ animationDelay: "0.5s" }}
                  />
                  <line
                    x1="50%"
                    y1="50%"
                    x2="30%"
                    y2="75%"
                    className="animate-line"
                    style={{ animationDelay: "1s" }}
                  />
                  <line
                    x1="50%"
                    y1="50%"
                    x2="70%"
                    y2="70%"
                    className="animate-line"
                    style={{ animationDelay: "1.5s" }}
                  />
                </svg>
                <div className="relative z-10 w-12 h-12 rounded-full text-gold-light border border-primary/20 bg-white dark:bg-neutral-900 flex items-center justify-center text-lg shadow-md">
                  <Globe />
                </div>
                {/* Linked Nodes orbiting around main hub */}
                <div className="absolute top-8 left-12 w-7 h-7 rounded-full text-gold-light bg-neutral-200/50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-xs">
                  <BookOpen size={14} />
                </div>
                <div className="absolute top-6 right-14 w-7 h-7 rounded-full text-gold-light bg-neutral-200/50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-xs">
                  <Notebook size={14} />
                </div>
                <div className="absolute bottom-8 left-14 w-7 h-7 rounded-full text-gold-light bg-neutral-200/50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-xs">
                  <Stars size={14} />
                </div>
                <div className="absolute bottom-6 right-16 w-7 h-7 rounded-full text-gold-light bg-neutral-200/50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-xs">
                  <Palette size={14} />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                  Curated Public Library
                </h3>
                <p className="text-sm font-light leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Access an expansive catalogue of public domain titles, rare
                  works, and open translations shared by global community
                  curators.
                </p>
              </div>
            </CardContent>
          </Card>
        </RevealWrapper>

        {/* ── CARD 4: Reader/Translation Framework (Bottom Left - Row 2, Col 1-2 [WIDER BLOCK]) ── */}
        <RevealWrapper className="md:col-span-2" delay={250}>
          <Card className="rounded-[1.5rem] border border-neutral-200/60 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-0 h-full overflow-hidden">
            <CardContent className="p-7 sm:p-9 flex flex-col justify-between h-full min-h-[360px]">
              {/* Immersive Distraction Free Workspace Simulation Bar Container */}
              <div className="w-full bg-white dark:bg-neutral-950 rounded-xl border border-neutral-200/50 dark:border-neutral-800 p-5 font-heading text-sm text-neutral-800 dark:text-neutral-200 shadow-sm mb-6 relative">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-100 dark:border-neutral-900 font-sans text-xs text-neutral-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="font-medium tracking-wide">
                      Publication Grade Translation AI
                    </span>
                  </div>
                  <div className="flex gap-1.5 opacity-60">
                    <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px]">
                      Serif
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px]">
                      Ad-Free
                    </span>
                  </div>
                </div>
                <p className="italic font-light leading-relaxed text-neutral-400 dark:text-neutral-500 mb-2 text-xs">
                  Original: &ldquo;Il faut imaginer Sisyphe heureux.&rdquo;
                </p>
                <p className="leading-relaxed font-normal text-neutral-800 dark:text-neutral-200">
                  &ldquo;One must imagine Sisyphus happy.&rdquo; —{" "}
                  <span className="border-b border-primary/40 pb-0.5">
                    Rendered with structural literary fidelity.
                  </span>
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                  Pure Reader & AI Translation Engine
                </h3>
                <p className="text-sm font-light leading-relaxed text-neutral-500 dark:text-neutral-400 max-w-2xl">
                  A premium, zero-distraction layout tuned for literary
                  absorption. Read comfortably or trigger publication-level AI
                  mechanics to accurately convert language structures without
                  breaking contextual tone.
                </p>
              </div>
            </CardContent>
          </Card>
        </RevealWrapper>

        {/* ── CARD 5: Voice Assistant (Bottom Right - Row 2, Col 3 [MATCHING image_4b1863.png]) ── */}
        <RevealWrapper delay={300}>
          <Card className="rounded-[1.5rem] border border-neutral-200/60 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-0 h-full flex flex-col justify-between overflow-hidden">
            <CardContent className="p-7 sm:p-8 flex flex-col h-full justify-between min-h-[360px]">
              {/* Waveform Module Replicating image_4b1863.png exactly */}
              <div className="h-40 w-full flex flex-col items-center justify-center bg-neutral-100/40 dark:bg-neutral-950/40 rounded-xl border border-neutral-200/30 dark:border-neutral-800/50 font-mono text-xs mb-6 text-center">
                {/* Floating Central Diamond Asset */}
                <div className="w-6 h-6 rotate-45 rounded bg-neutral-300 dark:bg-neutral-700 shadow-sm mb-4 animate-float" />

                {/* Counter Label */}
                <div className="text-neutral-400 dark:text-neutral-500 font-medium tracking-wider mb-3">
                  00:01
                </div>

                {/* Interactive Bouncing Sound Waveform Bars */}
                <div className="flex items-center gap-[3px] h-6 mb-3 px-4">
                  {[
                    0.4, 0.8, 0.5, 0.9, 0.3, 0.7, 0.4, 0.9, 0.6, 0.3, 0.8, 0.5,
                    0.9, 0.4, 0.7,
                  ].map((height, index) => (
                    <span
                      key={index}
                      className="w-[2px] bg-neutral-400 dark:bg-neutral-500 rounded-full block h-full origin-center animate-wave"
                      style={{
                        animationDelay: `${index * 0.07}s`,
                        animationDuration: `${0.8 + height}s`,
                      }}
                    />
                  ))}
                </div>

                {/* Processing State Indicator Tag */}
                <div className="font-sans text-xs text-neutral-600 dark:text-neutral-400 tracking-wide font-medium animate-pulse">
                  Listening...
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                  Immersive Audio Companion
                </h3>
                <p className="text-sm font-light leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Step out of the viewport. Shift workflows instantly into
                  speech outputs using high-fidelity natural vocal rendering
                  pipelines.
                </p>
              </div>
            </CardContent>
          </Card>
        </RevealWrapper>
      </div>
    </section>
  );
}
