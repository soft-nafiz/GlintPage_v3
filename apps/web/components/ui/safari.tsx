import { LockKeyhole } from "lucide-react";
import type { HTMLAttributes } from "react";

export interface SafariProps extends HTMLAttributes<HTMLDivElement> {
  url?: string;
  imageSrc?: string;
  videoSrc?: string;
}

export function Safari({
  imageSrc,
  videoSrc,
  url = "glintpage.com",
  className,
  style,
  ...props
}: SafariProps) {
  const hasVideo = !!videoSrc;

  return (
    <div
      className={`w-full overflow-hidden rounded-xl border border-neutral-200 bg-paper  dark:border-neutral-800 dark:bg-neutral-900 ${className ?? ""}`}
      style={style}
      {...props}
    >
      {/* 1. Browser Header Window Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-paper dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 select-none">
        {/* Window Controls (Red, Yellow, Green dots) */}
        <div className="flex space-x-2 w-16">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400 dark:bg-red-500/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400 dark:bg-yellow-500/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400 dark:bg-green-500/70" />
        </div>

        {/* URL Input Box */}
        <div className="flex-1 max-w-xl mx-4">
          <div className="flex items-center gap-1 justify-center w-full h-6 bg-paper-dim dark:bg-neutral-800 rounded-sm text-xs text-neutral-400 dark:text-neutral-500 font-sans border border-neutral-200/50 dark:border-neutral-700/50 tracking-wide truncate px-3">
            <LockKeyhole size={12} /> {url}
          </div>
        </div>

        {/* Right Empty Spacer to balance the layout */}
        <div className="w-16 flex justify-end space-x-2 text-neutral-400 opacity-60">
          <div className="h-3 w-4  " />
        </div>
      </div>

      {/* 2. Content Display Window */}
      <div className="relative w-full bg-white dark:bg-neutral-950">
        {hasVideo ? (
          <video
            className="w-full h-auto block object-cover"
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          imageSrc && (
            <img
              src={imageSrc}
              alt="Application Viewport Mockup"
              className="w-full h-auto block object-cover object-top"
            />
          )
        )}
      </div>
    </div>
  );
}
