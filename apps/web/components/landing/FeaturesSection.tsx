import { RevealWrapper } from "./RevealWrapper";
import { Card, CardContent } from "@/components/ui/card";

/* ── Small reusable atoms ── */

function CardIcon({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-12 h-12 rounded-[14px] flex items-center justify-center text-[22px] mb-7"
      style={{
        background: "var(--gold-glow)",
        border: "1px solid oklch(0.634 0.108 72 / 0.25)",
      }}
    >
      {children}
    </div>
  );
}

function CardHeading({
  children,
  dark,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <h3
      className="font-heading text-[22px] sm:text-[26px] font-normal leading-tight tracking-[-0.01em] mb-3"
      style={{ color: dark ? "var(--paper)" : "var(--ink)" }}
    >
      {children}
    </h3>
  );
}

function CardBody({
  children,
  dark,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <p
      className="text-[15px] font-light leading-[1.7]"
      style={{ color: dark ? "oklch(0.963 0.014 85 / 0.6)" : "var(--ink-60)" }}
    >
      {children}
    </p>
  );
}

/* ── Translation pipeline visual ── */
function TranslationVisual() {
  return (
    <div className="flex flex-col gap-3 mt-10">
      <div
        className="p-4 rounded-xl text-[15px] leading-[1.7] font-heading"
        style={{
          background: "oklch(1 0 0 / 0.06)",
          border: "1px solid oklch(1 0 0 / 0.10)",
          color: "oklch(0.963 0.014 85 / 0.5)",
        }}
      >
        <div
          className="text-[10px] font-sans font-semibold tracking-[0.1em] uppercase mb-1.5"
          style={{ color: "oklch(0.732 0.098 76 / 0.7)" }}
        >
          Source · French
        </div>
        &ldquo;Il faut imaginer Sisyphe heureux.&rdquo;
      </div>

      <div className="self-center text-xl" style={{ color: "var(--gold)" }}>
        ↓
      </div>

      <div
        className="p-4 rounded-xl text-[15px] leading-[1.7] font-heading"
        style={{
          background: "oklch(0.634 0.108 72 / 0.15)",
          border: "1px solid oklch(0.634 0.108 72 / 0.3)",
          color: "oklch(0.963 0.014 85 / 0.9)",
        }}
      >
        <div
          className="text-[10px] font-sans font-semibold tracking-[0.1em] uppercase mb-1.5"
          style={{ color: "oklch(0.732 0.098 76 / 0.7)" }}
        >
          Glintpage · English
        </div>
        &ldquo;One must imagine Sisyphus happy.&rdquo;
        <p
          className="font-sans text-[12px] mt-2 not-italic"
          style={{ color: "oklch(0.963 0.014 85 / 0.4)" }}
        >
          Camus uses irony — translated with full tonal fidelity.
        </p>
      </div>
    </div>
  );
}

/* ── UI preview in Distraction-Free card ── */
type Opt = { label: string; active: boolean };

function UiPreviewRow({ label, opts }: { label: string; opts: Opt[] }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-foreground/08 last:border-0">
      <span className="text-[13px] text-muted-foreground flex-1">{label}</span>
      <div className="flex gap-1">
        {opts.map((o) => (
          <span
            key={o.label}
            className="px-3 py-1 rounded-full text-[12px] font-medium"
            style={
              o.active
                ? { background: "var(--ink)", color: "var(--paper)" }
                : {
                    background: "var(--paper)",
                    border: "1px solid var(--ink-08)",
                    color: "var(--ink-60)",
                  }
            }
          >
            {o.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function UiPreview() {
  return (
    <div
      className="mt-7 rounded-[14px] p-4"
      style={{
        background: "var(--paper-dim)",
        border: "1px solid var(--ink-08)",
      }}
    >
      <UiPreviewRow
        label="Font"
        opts={[
          { label: "Serif", active: true },
          { label: "Sans", active: false },
        ]}
      />
      <UiPreviewRow
        label="Layout"
        opts={[
          { label: "Focused", active: true },
          { label: "Split", active: false },
        ]}
      />
      <UiPreviewRow
        label="Theme"
        opts={[
          { label: "Warm", active: true },
          { label: "Dark", active: false },
        ]}
      />
    </div>
  );
}

/* ── Sync animation visual ── */
function SyncVisual() {
  return (
    <div className="flex items-center justify-center gap-4 mt-7">
      <div
        className="w-12 h-12 rounded-[12px] flex items-center justify-center text-[22px]"
        style={{
          background: "var(--paper)",
          border: "1px solid var(--ink-08)",
        }}
      >
        🖥
      </div>

      <div
        className="flex-1 relative h-px"
        style={{
          background: "linear-gradient(90deg, var(--gold-light), var(--sage))",
        }}
      >
        <div
          className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full animate-sync-dot"
          style={{
            background: "var(--gold)",
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>

      <div
        className="w-12 h-12 rounded-[12px] flex items-center justify-center text-[22px]"
        style={{
          background: "var(--paper)",
          border: "1px solid var(--ink-08)",
        }}
      >
        📱
      </div>
    </div>
  );
}

/* ── Section ── */
export function FeaturesSection() {
  return (
    <section
      id="features"
      className="py-24 sm:py-32 px-5 sm:px-8 lg:px-12 max-w-7xl mx-auto"
    >
      {/* Header */}
      <RevealWrapper>
        <span className="text-xs font-semibold tracking-[0.14em] uppercase text-primary block mb-4">
          Capabilities
        </span>
      </RevealWrapper>
      <RevealWrapper delay={80}>
        <h2
          className="font-heading font-light tracking-[-0.02em] leading-[1.05] mb-14"
          style={{ fontSize: "clamp(34px, 5vw, 58px)" }}
        >
          Designed for the
          <br />
          <em className="italic text-primary">modern reader.</em>
        </h2>
      </RevealWrapper>

      {/* Bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-[18px]">
        {/* Card 1 — large, dark, AI Translation */}
        <RevealWrapper className="lg:row-span-2">
          <Card
            className="h-full rounded-[1.75rem] border-0 p-0 overflow-hidden"
            style={{ background: "var(--ink)" }}
          >
            <CardContent className="p-8 sm:p-11 flex flex-col h-full">
              <div
                className="w-12 h-12 rounded-[14px] flex items-center justify-center text-[22px] mb-7"
                style={{
                  background: "oklch(0.634 0.108 72 / 0.15)",
                  border: "1px solid oklch(0.634 0.108 72 / 0.3)",
                }}
              >
                🧠
              </div>
              <CardHeading dark>Context-Aware AI Translation</CardHeading>
              <CardBody dark>
                Glintpage doesn&apos;t just swap words — it understands the
                nuance, tone, and intent of the original author. Every sentence
                is rendered with literary precision.
              </CardBody>
              <TranslationVisual />
            </CardContent>
          </Card>
        </RevealWrapper>

        {/* Card 2 — Distraction-Free UI */}
        <RevealWrapper delay={100}>
          <Card className="rounded-[1.75rem] border border-foreground/08 p-0">
            <CardContent className="p-8 sm:p-10">
              <CardIcon>✦</CardIcon>
              <CardHeading>Distraction-Free UI</CardHeading>
              <CardBody>
                A highly polished, minimalist reading environment that gets out
                of your way — so the words can do their work.
              </CardBody>
              <UiPreview />
            </CardContent>
          </Card>
        </RevealWrapper>

        {/* Card 3 — Cross-Device Sync */}
        <RevealWrapper delay={200}>
          <Card className="rounded-[1.75rem] border border-foreground/08 p-0">
            <CardContent className="p-8 sm:p-10">
              <CardIcon>🔄</CardIcon>
              <CardHeading>Cross-Device Sync</CardHeading>
              <CardBody>
                Start reading on your desktop, pick up exactly where you left
                off on your phone. Your progress, highlights, and notes follow
                you everywhere.
              </CardBody>
              <SyncVisual />
            </CardContent>
          </Card>
        </RevealWrapper>
      </div>
    </section>
  );
}
