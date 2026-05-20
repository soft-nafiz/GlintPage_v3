export function ReaderMockup() {
  return (
    <div
      className="w-full rounded-[1.75rem] border border-foreground/10 overflow-hidden"
      style={{
        boxShadow:
          "0 2px 4px oklch(0.101 0.005 265 / 0.04), 0 12px 40px oklch(0.101 0.005 265 / 0.10), 0 40px 80px oklch(0.101 0.005 265 / 0.07)",
      }}
    >
      {/* Window chrome bar */}
      <div className="bg-secondary flex items-center gap-3 px-5 py-3 border-b border-foreground/10">
        <div className="flex gap-[7px]">
          <span className="w-[11px] h-[11px] rounded-full bg-[#FF6058]" />
          <span className="w-[11px] h-[11px] rounded-full bg-[#FFBD2E]" />
          <span className="w-[11px] h-[11px] rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 bg-card rounded-[7px] h-7 flex items-center justify-center">
          <span className="text-xs text-muted-foreground font-light">
            Glintpage Reader · Dostoevsky, F. M.
          </span>
        </div>
      </div>

      {/* Split pane body */}
      <div className="relative grid grid-cols-2 min-h-[300px] sm:min-h-[380px]">
        {/* Floating translation badge */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 animate-badge-pulse"
          style={{
            background: "var(--gold)",
            color: "#fff",
            fontSize: "11px",
            fontWeight: 600,
            padding: "7px 14px",
            borderRadius: "100px",
            whiteSpace: "nowrap",
            letterSpacing: "0.04em",
          }}
        >
          ✦ AI Translation Active
        </div>

        {/* Left pane — original */}
        <div className="p-6 sm:p-9">
          <div className="flex items-center gap-1.5 mb-5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--sage)" }}
            />
            <span
              className="text-[11px] font-semibold tracking-[0.08em] uppercase"
              style={{ color: "var(--ink-40)" }}
            >
              Russian · Original
            </span>
          </div>
          <p
            className="font-heading text-[15px] leading-[1.85]"
            style={{ color: "var(--ink-80)" }}
          >
            Красота спасёт мир.
            <br />
            <br />
            Он вдруг остановился. В памяти его, как бы вдруг, мелькнул один
            образ — Аглаи. Он чуть не вскрикнул. Он долго смотрел на{" "}
            <span
              className="rounded-[3px] px-0.5"
              style={{ background: "oklch(0.634 0.108 72 / 0.12)" }}
            >
              письмо
            </span>
            , не решаясь распечатать его.
          </p>
        </div>

        {/* Right pane — translated */}
        <div
          className="p-6 sm:p-9 border-l border-foreground/10"
          style={{
            background:
              "linear-gradient(160deg, oklch(0.963 0.014 85 / 0.5) 0%, oklch(0.932 0.012 85 / 0.3) 100%)",
          }}
        >
          <div className="flex items-center gap-1.5 mb-5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--gold)" }}
            />
            <span
              className="text-[11px] font-semibold tracking-[0.08em] uppercase"
              style={{ color: "var(--ink-40)" }}
            >
              English · Translated
            </span>
          </div>
          <p
            className="font-heading text-[15px] leading-[1.85]"
            style={{ color: "var(--ink)" }}
          >
            Beauty will save the world.
            <br />
            <br />
            He suddenly stopped. A certain image, as if out of nowhere, flashed
            in his memory — Aglaya. He nearly cried out. He stared at the{" "}
            <span
              className="rounded-[3px] px-0.5"
              style={{ background: "oklch(0.634 0.108 72 / 0.12)" }}
            >
              letter
            </span>{" "}
            for a long time, unable to bring himself to open it.
          </p>
        </div>
      </div>

      {/* Footer bar */}
      <div className="bg-secondary border-t border-foreground/10 px-5 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-[120px] h-[3px] bg-foreground/10 rounded-full overflow-hidden">
            <div
              className="h-full w-[38%] rounded-full"
              style={{ background: "var(--gold)" }}
            />
          </div>
          <span className="text-xs font-light text-muted-foreground">
            38% · Chapter 5
          </span>
        </div>
        <div className="flex gap-2">
          {["Aa", "⌨", "⋯"].map((ctrl) => (
            <div
              key={ctrl}
              className="w-7 h-7 rounded-[7px] bg-card border border-foreground/10 flex items-center justify-center text-xs text-muted-foreground cursor-pointer"
            >
              {ctrl}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
