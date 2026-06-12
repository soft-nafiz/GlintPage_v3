import Link from "next/link";
import {
  getCurrentProfile,
  getServerSupabase,
  requireCurrentUser,
} from "@/lib/auth/server";
import {
  Flame,
  BookOpen,
  TrendingUp,
  Library,
  AlertTriangle,
  ArrowRight,
  Clock,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RotatingQuote } from "@/components/rotating-quote";
import { createMetadata } from "@/lib/seo";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import Image from "next/image";

import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";

export const metadata = createMetadata({
  title: "Dashboard",
  description:
    "Your private Glintpage dashboard for reading progress, daily AI usage, and recently opened books.",
  path: "/dashboard",
  noIndex: true,
});

// ─── Config ──────────────────────────────────────────────────────────────────

const TRANSLATION_TOKEN_LIMITS: Record<string, number> = {
  free: 2700,
  trial: 27000,
  plus: 27000,
  pro: 63000,
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  trial: "Trial",
  plus: "Plus",
  pro: "Pro",
};

type ProgressBook = {
  id?: string;
  title?: string;
  author?: string | null;
  cover_url?: string | null;
  page_count?: number | null;
};

const COVER_GRADIENTS = [
  "linear-gradient(135deg,#f59e0b,#ef4444)",
  "linear-gradient(135deg,#3b82f6,#6366f1)",
  "linear-gradient(135deg,#8b5cf6,#ec4899)",
  "linear-gradient(135deg,#10b981,#3b82f6)",
  "linear-gradient(135deg,#f97316,#eab308)",
  "linear-gradient(135deg,#64748b,#334155)",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function coverGradient(title: string) {
  return COVER_GRADIENTS[title.charCodeAt(0) % COVER_GRADIENTS.length];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const [supabase, user, profile] = await Promise.all([
    getServerSupabase(),
    requireCurrentUser(),
    getCurrentProfile(),
  ]);

  const today = new Date().toISOString().split("T")[0];

  // ── Parallel data fetch ──
  const [
    { data: todayUsage },
    { data: recentProgress },
    { data: allProgress },
    { data: recentActivity },
    { count: libraryCount },
  ] = await Promise.all([
    supabase
      .from("user_daily_usage")
      .select("translated_tokens, summarized_tokens")
      .eq("user_id", user.id)
      .eq("usage_date", today)
      .maybeSingle(),

    supabase
      .from("reading_progress")
      .select(
        "current_chunk_index, progress_percentage, last_read_at, book:books(id,title,author,cover_url,page_count)",
      )
      .eq("user_id", user.id)
      .order("last_read_at", { ascending: false })
      .limit(3),

    supabase
      .from("reading_progress")
      .select("progress_percentage, book:books(page_count)")
      .eq("user_id", user.id),

    supabase
      .from("user_daily_usage")
      .select("usage_date")
      .eq("user_id", user.id)
      .order("usage_date", { ascending: false })
      .limit(60),

    supabase
      .from("books")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  // ── Computed values ──
  const plan = (profile?.plan ?? "free") as string;
  const dailyLimit = TRANSLATION_TOKEN_LIMITS[plan] ?? 2700;
  const usedToday = todayUsage?.translated_tokens ?? 0;
  const usagePct = Math.min(Math.round((usedToday / dailyLimit) * 100), 100);
  const showWarning = usagePct >= 90;

  const booksFinished =
    allProgress?.filter((b) => (b.progress_percentage ?? 0) >= 95).length ?? 0;
  const totalPagesRead =
    allProgress?.reduce((sum, b) => {
      const pages = (b.book as ProgressBook | null)?.page_count ?? 0;
      return sum + Math.floor(pages * ((b.progress_percentage ?? 0) / 100));
    }, 0) ?? 0;

  // Streak: count consecutive days backward from today
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    if (recentActivity?.some((a) => a.usage_date === ds)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "Reader";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen  md:p-8 my-10">
      <div className="max-w-7xl px-4 md:px-0 mx-auto space-y-16">
        {/* ── 1. HERO ──────────────────────────────────────────────────── */}
        <div
          className="relative rounded-3xl overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, #1c1917 0%, #292524 60%, #1c1917 100%)",
            boxShadow: "0 24px 48px -12px rgba(0,0,0,0.35)",
          }}
        >
          {/* Subtle texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          {/* Glow orbs */}
          <div
            className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-10"
            style={{
              background: "radial-gradient(circle, #6366f1, transparent)",
            }}
          />
          <div
            className="absolute bottom-0 right-1/3 w-64 h-64 rounded-full blur-3xl opacity-10"
            style={{
              background: "radial-gradient(circle, #8b5cf6, transparent)",
            }}
          />

          <div className="relative z-10 flex items-center justify-between p-8 md:p-10">
            {/* Left: greeting + quote */}
            <div className="flex flex-col gap-3">
              <div>
                <p
                  className="text-xs font-medium tracking-widest uppercase mb-2"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {greeting}
                </p>
                <h1 className="text-3xl md:text-4xl font-bold text-white font-heading">
                  Welcome back, {firstName}
                  <span style={{ color: "#f59e0b" }}>.</span>
                </h1>
              </div>
              <RotatingQuote />

              {/* Plan badge */}
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor:
                      plan === "pro"
                        ? "rgba(251,191,36,0.15)"
                        : "rgba(255,255,255,0.08)",
                    color: plan === "pro" ? "#fbbf24" : "rgba(255,255,255,0.4)",
                    border: `1px solid ${plan === "pro" ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.1)"}`,
                  }}
                >
                  {PLAN_LABELS[plan]} Plan
                </span>
              </div>
            </div>

            {/* Right: Streak */}
            <div className="flex flex-col items-center gap-2 shrink-0 ml-8">
              {/* Flame with glow */}
              <div className="relative flex items-center justify-center">
                <div
                  className="absolute w-20 h-20 rounded-full blur-2xl animate-pulse"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(251,146,60,0.6), transparent)",
                  }}
                />
                <Flame
                  className="w-14 h-14 relative z-10"
                  style={{
                    color: "#fb923c",
                    filter: "drop-shadow(0 0 12px rgba(251,146,60,0.7))",
                  }}
                />
              </div>

              {/* Streak number */}
              <div className="text-center">
                <p
                  className="leading-none font-black text-white font-heading"
                  style={{
                    fontSize: "clamp(3rem, 8vw, 5rem)",

                    textShadow: "0 0 40px rgba(251,146,60,0.3)",
                  }}
                >
                  {streak}
                </p>
                <p
                  className="text-[11px] font-semibold tracking-widest uppercase mt-1"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  Day Streak
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. CREDIT WARNING ────────────────────────────────────────── */}
        {showWarning && (
          <div
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{
              backgroundColor: "rgba(239,68,68,0.04)",
              border: "1px solid rgba(239,68,68,0.25)",
              boxShadow:
                "0 0 0 1px rgba(239,68,68,0.08), 0 8px 32px rgba(239,68,68,0.08)",
            }}
          >
            {/* Pulse dot */}
            <div className="relative shrink-0">
              <div
                className="absolute inset-0 rounded-full animate-ping opacity-40"
                style={{ backgroundColor: "#ef4444" }}
              />
              <div
                className="relative w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
              >
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-600">
                {usagePct >= 100
                  ? "Daily AI token limit reached"
                  : `${usagePct}% of today's translation tokens used`}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: "rgba(220,38,38,0.6)" }}
              >
                {formatCompactNumber(usedToday)} of{" "}
                {formatCompactNumber(dailyLimit)} tokens used today
                {usagePct < 100
                  ? " — upgrade for more headroom"
                  : " — resets at midnight UTC"}
                .
              </p>
            </div>

            <Link href="/billing" className="shrink-0">
              <Button
                size="sm"
                className="rounded-xl gap-2 text-xs font-semibold"
                style={{
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  border: "none",
                  color: "white",
                }}
              >
                Upgrade Plan
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        )}

        {/* ── 3.STATS ROW ────────────────────────────────────── */}

        <Card className="  p-0  ring-0 shadow-none rounded-none">
          <CardHeader className="text-sm font-bold tracking-widest uppercase p-0">
            Your Stats
          </CardHeader>

          {/* Stat cells */}
          <CardContent className="grid grid-cols-3 gap-3 p-0">
            {/* Pages read */}
            <div
              className="rounded-xl p-4"
              style={{
                backgroundColor: "rgba(99,102,241,0.05)",
                border: "1px solid rgba(99,102,241,0.1)",
              }}
            >
              <BookOpen className="w-4 h-4 mb-3 text-muted-foreground" />
              <p className="text-3xl font-bold font-heading">
                {totalPagesRead.toLocaleString()}
              </p>
              <p className="text-sm mt-1 text-muted-foreground">Pages read</p>
            </div>

            {/* Books finished */}
            <div
              className="rounded-xl p-4"
              style={{
                backgroundColor: "rgba(16,185,129,0.05)",
                border: "1px solid rgba(16,185,129,0.1)",
              }}
            >
              <TrendingUp className="w-4 h-4 mb-3 text-muted-foreground" />
              <p className="text-3xl font-bold font-heading">{booksFinished}</p>
              <p className="text-sm text-muted-foreground mt-1">Finished</p>
            </div>

            {/* Library */}
            <div
              className="rounded-xl p-4"
              style={{
                backgroundColor: "rgba(139,92,246,0.05)",
                border: "1px solid rgba(139,92,246,0.1)",
              }}
            >
              <Library className="w-4 h-4 mb-3 text-muted-foreground" />
              <p className="text-3xl font-bold font-heading">
                {libraryCount ?? 0}
              </p>
              <p className="text-sm mt-1 text-muted-foreground">In library</p>
            </div>
          </CardContent>

          {/* Daily usage bar */}
          <CardFooter className="flex-col items-start p-0">
            <div className="w-full flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" style={{ color: "#a8a29e" }} />
                <p className="text-sm font-medium text-muted-foreground">
                  Today&apos;s Translation Tokens
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums text-muted-foreground">
                {formatCompactNumber(usedToday)} /{" "}
                {formatCompactNumber(dailyLimit)}
              </p>
            </div>

            <p className="text-xs mt-1.5 text-neutral-500">
              Resets at midnight UTC
            </p>
          </CardFooter>
        </Card>

        {/* ── 4. CONTINUE READING ──────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
              Continue Reading
            </p>
            <Link
              href="/library"
              className="flex items-center gap-1 text-sm font-medium transition-colors hover:opacity-70 text-primary"
            >
              View all
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentProgress && recentProgress.length > 0 ? (
            <ItemGroup>
              {recentProgress.map((item) => {
                const book = item.book as ProgressBook | null;
                if (!book?.id || !book.title) return null;
                const pct = Math.round(item.progress_percentage ?? 0);

                return (
                  <Item
                    key={book.id}
                    className="border border-border p-2 md:p-3"
                  >
                    {/* Cover */}

                    <ItemMedia>
                      {book.cover_url ? (
                        <div className="h-24 md:h-36 relative rounded-xl overflow-hidden border border-border">
                          <Image
                            crossOrigin="anonymous"
                            src={book.cover_url}
                            alt={book.title}
                            height={500}
                            width={500}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 "
                          />
                        </div>
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{
                            background: coverGradient(book.title),
                          }}
                        >
                          <span
                            className="text-white/40 font-black select-none"
                            style={{
                              fontSize: "4rem",
                              fontFamily: "Georgia, serif",
                            }}
                          >
                            {book.title.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </ItemMedia>

                    {/* Info */}
                    <ItemContent className="h-24 md:h-36 flex-col justify-between py-4 md:py-8 relative">
                      <div className="absolute top-0 md:top-4.5 left-0 text-xs  md:py-0.5  flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {timeAgo(item.last_read_at)}
                      </div>
                      <div className="w-full flex flex-row justify-between">
                        <ItemTitle>{book.title}</ItemTitle>
                        {book.author && (
                          <ItemDescription className="text-xs truncate mt-0.5 text-muted-foreground">
                            {book.author}
                          </ItemDescription>
                        )}
                        <Link
                          href={`/read/${book.id}`}
                          className="hidden md:flex"
                        >
                          <Button className="cursor-pointer">
                            <BookOpen /> Continue reading <ChevronRight />
                          </Button>
                        </Link>
                        <Link href={`/read/${book.id}`} className="md:hidden">
                          <button className="cursor-pointer p-2 text-primary">
                            <ExternalLink size={22} />
                          </button>
                        </Link>
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div className="h-1.5 rounded-full overflow-hidden bg-paper-dim">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${pct}%`,

                              transition:
                                "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                            }}
                          />
                        </div>
                        <div className="flex justify-between mt-1">
                          <p className="text-xs text-muted-foreground">
                            Page {item.current_chunk_index} of{" "}
                            {book.page_count ?? "?"}
                          </p>
                          <p className="text-xs font-medium text-muted-foreground">
                            {pct}% done
                          </p>
                        </div>
                      </div>
                    </ItemContent>
                  </Item>
                );
              })}

              {/* Fill empty slots with placeholder cards (max 3 total) */}
              {Array.from({
                length: Math.max(0, 3 - (recentProgress?.length ?? 0)),
              }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 md:gap-3 p-2 md:p-6 border-border"
                >
                  <div className="w-8 h-8 md:w-12 md:h-12 rounded-2xl flex items-center justify-center bg-accent">
                    <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs md:text-sm font-medium text-muted-foreground">
                      Start a book
                    </p>
                    <p className="text-[10px] md:text-xs mt-0.5 text-neutral-400">
                      Your next read awaits
                    </p>
                  </div>
                  <Link href="/library">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-muted-foreground cursor-pointer max-md:text-xs"
                    >
                      Browse library
                    </Button>
                  </Link>
                </div>
              ))}
            </ItemGroup>
          ) : (
            /* Full empty state */
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ backgroundColor: "#f5f3f0" }}
              >
                <BookOpen className="w-7 h-7" style={{ color: "#d6d3d1" }} />
              </div>
              <p
                className="text-base font-semibold mb-1"
                style={{ color: "#78716c", fontFamily: "Georgia, serif" }}
              >
                No books started yet
              </p>
              <p className="text-sm mb-5" style={{ color: "#a8a29e" }}>
                Upload a book to begin your reading journey
              </p>
              <Link href="/library">
                <Button
                  size="sm"
                  className="rounded-xl gap-2"
                  style={{
                    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                    border: "none",
                    color: "white",
                  }}
                >
                  Go to Library
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
