"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  saveReadingProgress,
  togglePrefetch,
  translatePage,
  summarizePage,
} from "@/lib/actions/translate";
import {
  Menu,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
  Plus,
  Minus,
  Clock,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "motion/react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const THEMES = [
  {
    id: "paper",
    name: "Paper",
    bg: "#faf8f4",
    text: "#2c2417",
    muted: "#9c8c78",
    border: "#e8e0d0",
    accent: "#8b6f47",
    card: "#f2ede4",
  },
  {
    id: "white",
    name: "White",
    bg: "#ffffff",
    text: "#1a1a1a",
    muted: "#71717a",
    border: "#e4e4e7",
    accent: "#6366f1",
    card: "#f4f4f5",
  },
  {
    id: "dark",
    name: "Dark",
    bg: "#18181b",
    text: "#e4e4e7",
    muted: "#71717a",
    border: "#27272a",
    accent: "#a78bfa",
    card: "#1f1f23",
  },
  {
    id: "oled",
    name: "OLED",
    bg: "#000000",
    text: "#ffffff",
    muted: "#71717a",
    border: "#18181b",
    accent: "#818cf8",
    card: "#0a0a0a",
  },
  {
    id: "forest",
    name: "Forest",
    bg: "#141f14",
    text: "#c8dfc8",
    muted: "#6a8f6a",
    border: "#1f321f",
    accent: "#4ade80",
    card: "#0e170e",
  },
] as const;

const LANGUAGES = [
  { code: "none", label: "Original" },
  { code: "Bengali", label: "বাংলা" },
  { code: "Spanish", label: "Español" },
  { code: "French", label: "Français" },
  { code: "Arabic", label: "العربية" },
  { code: "Hindi", label: "हिन्दी" },
  { code: "Portuguese", label: "Português" },
  { code: "Russian", label: "Русский" },
  { code: "Japanese", label: "日本語" },
  { code: "German", label: "Deutsch" },
  { code: "Chinese", label: "中文" },
  { code: "Turkish", label: "Türkçe" },
  { code: "Korean", label: "한국어" },
  { code: "Italian", label: "Italiano" },
];

const FONT_SIZES = [13, 14, 15, 16, 17, 18, 20, 22, 24];
const LINE_HEIGHTS = [1.4, 1.6, 1.8, 2.0, 2.4];
const LINE_WIDTHS: Record<string, string> = {
  "2xl": "42rem",
  "3xl": "48rem",
  "4xl": "56rem",
  "5xl": "64rem",
};

const SKELETON_WIDTHS = [
  "92%",
  "87%",
  "95%",
  "78%",
  "90%",
  "83%",
  "98%",
  "96%",
  "88%",
  "92%",
  "86%",
  "76%",
];
const SUMMARY_SKELETON_WIDTHS = ["88%", "94%", "79%", "91%", "85%", "72%"];

const PREFS_KEY = "glintpage_reader_v1";
const SETTLE_DELAY_MS = 1200;
const PREFETCH_DELAY_MS = 3500;
const MIN_AI_GAP_MS = 2000;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Theme = (typeof THEMES)[number];
type Page = { id: string; page_number: number; content: string };
type Book = {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  page_count: number;
};
type Prefs = {
  themeId: string;
  fontSize: number;
  lineHeight: number;
  lineWidth: string;
  lang: string;
};
type TxStatus =
  | "idle"
  | "waiting"
  | "translating"
  | "prefetching"
  | "rate_limited"
  | "error"
  | "no_credits";
type SummaryStatus = "idle" | "loading" | "error";

const DEFAULT_PREFS: Prefs = {
  themeId: "paper",
  fontSize: 17,
  lineHeight: 1.8,
  lineWidth: "3xl",
  lang: "none",
};

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

function useReaderPrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  const updatePref = useCallback(
    <K extends keyof Prefs>(key: K, val: Prefs[K]) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: val };
        try {
          localStorage.setItem(PREFS_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [],
  );

  return { prefs, updatePref };
}

function usePageNavigation(book: Book, initialPage: Page, totalPages: number) {
  const [currentPage, setCurrentPage] = useState<Page>(initialPage);
  const [isNavigating, setIsNavigating] = useState(false);

  const pageCache = useRef<Map<number, Page>>(
    new Map([[initialPage.page_number, initialPage]]),
  );
  const isNavigatingRef = useRef(false);
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  useEffect(() => {
    saveReadingProgress(
      book.id,
      currentPage.page_number,
      (currentPage.page_number / totalPages) * 100,
    );
  }, [currentPage.page_number, book.id, totalPages]);

  const goToPage = useCallback(
    async (num: number) => {
      if (num < 1 || num > totalPages || isNavigatingRef.current) return;
      isNavigatingRef.current = true;
      setIsNavigating(true);

      let page = pageCache.current.get(num);
      if (!page) {
        try {
          const res = await fetch(
            `/api/book_page?bookId=${book.id}&pageNumber=${num}`,
          );
          const data = await res.json();
          if (data.page) {
            pageCache.current.set(num, data.page);
            page = data.page;
          }
        } catch {
          isNavigatingRef.current = false;
          setIsNavigating(false);
          return;
        }
      }

      if (page) setCurrentPage(page);
      isNavigatingRef.current = false;
      setIsNavigating(false);
    },
    [book.id, totalPages],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "ArrowRight" || e.key === "l") {
        e.preventDefault();
        goToPage(currentPageRef.current.page_number + 1);
      }
      if (e.key === "ArrowLeft" || e.key === "h") {
        e.preventDefault();
        goToPage(currentPageRef.current.page_number - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goToPage]);

  return { currentPage, isNavigating, goToPage, pageCache, currentPageRef };
}

function useTranslationEngine(
  currentPage: Page,
  lang: string,
  book: Book,
  totalPages: number,
  pageCache: React.MutableRefObject<Map<number, Page>>,
  currentPageRef: React.MutableRefObject<Page>,
  prefetchEnabled: boolean,
) {
  const [displayContent, setDisplay] = useState(currentPage.content);
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [noCredits, setNoCredits] = useState(false);

  const prefetchEnabledRef = useRef(prefetchEnabled);
  prefetchEnabledRef.current = prefetchEnabled;

  const txCache = useRef<Map<string, string>>(new Map());
  const requestId = useRef(0);
  const lastAICallTime = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const langRef = useRef(lang);
  langRef.current = lang;

  const callTranslate = useCallback(
    async (page: Page, targetLang: string): Promise<string | null> => {
      const myId = ++requestId.current;
      const elapsed = Date.now() - lastAICallTime.current;
      if (elapsed < MIN_AI_GAP_MS)
        await new Promise((r) => setTimeout(r, MIN_AI_GAP_MS - elapsed));
      if (myId !== requestId.current) return null;

      const result = await translatePage(page.id, targetLang, page.content);
      if (myId !== requestId.current) return null;

      lastAICallTime.current = Date.now();

      if (
        result.error === "DAILY_LIMIT_REACHED" ||
        result.error?.includes("Not enough credits")
      ) {
        setNoCredits(true);
        setTxStatus("no_credits");
        return null;
      }
      if (result.error || !result.translation) {
        setTxStatus("error");
        return null;
      }
      return result.translation;
    },
    [],
  );

  const runTranslation = useCallback(
    async (page: Page, targetLang: string) => {
      if (targetLang === "none") {
        setDisplay(page.content);
        setTxStatus("idle");
        return;
      }
      const cacheKey = `${page.id}:${targetLang}`;
      if (txCache.current.has(cacheKey)) {
        setDisplay(txCache.current.get(cacheKey)!);
        setTxStatus("idle");
        return;
      }
      setTxStatus("translating");
      const text = await callTranslate(page, targetLang);
      if (!text) {
        setDisplay(page.content);
        return;
      }
      txCache.current.set(cacheKey, text);
      setDisplay(text);
      setTxStatus("idle");
    },
    [callTranslate],
  );

  const schedulePrefetch = useCallback(
    (afterPage: Page, targetLang: string) => {
      clearTimeout(prefetchTimer.current);
      if (!prefetchEnabledRef.current) return;
      if (targetLang === "none" || afterPage.page_number >= totalPages) return;
      const nextNum = afterPage.page_number + 1;

      prefetchTimer.current = setTimeout(async () => {
        if (!prefetchEnabledRef.current) return;
        if (
          currentPageRef.current.id !== afterPage.id ||
          langRef.current !== targetLang
        )
          return;

        let nextPage = pageCache.current.get(nextNum);
        if (!nextPage) {
          try {
            const res = await fetch(
              `/api/book_page?bookId=${book.id}&pageNumber=${nextNum}`,
            );
            const data = await res.json();
            if (data.page) {
              nextPage = data.page;
              pageCache.current.set(nextNum, data.page);
            }
          } catch {
            return;
          }
        }
        if (!nextPage) return;

        const cacheKey = `${nextPage.id}:${targetLang}`;
        if (txCache.current.has(cacheKey)) return;
        if (!prefetchEnabledRef.current) return;
        if (
          currentPageRef.current.id !== afterPage.id ||
          langRef.current !== targetLang
        )
          return;

        setTxStatus("prefetching");
        const text = await callTranslate(nextPage, targetLang);
        if (text) txCache.current.set(cacheKey, text);
        if (currentPageRef.current.id === afterPage.id) setTxStatus("idle");
      }, PREFETCH_DELAY_MS);
    },
    [book.id, totalPages, callTranslate, pageCache, currentPageRef],
  );

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    clearTimeout(prefetchTimer.current);
    requestId.current++;

    if (lang !== "none" && txCache.current.has(`${currentPage.id}:${lang}`)) {
      setDisplay(txCache.current.get(`${currentPage.id}:${lang}`)!);
      setTxStatus("idle");
      schedulePrefetch(currentPage, lang);
      return;
    }
    if (lang === "none") {
      setDisplay(currentPage.content);
      setTxStatus("idle");
      return;
    }

    setTxStatus("waiting");
    debounceTimer.current = setTimeout(async () => {
      await runTranslation(currentPage, lang);
      schedulePrefetch(currentPage, lang);
    }, SETTLE_DELAY_MS);

    return () => {
      clearTimeout(debounceTimer.current);
      clearTimeout(prefetchTimer.current);
    };
  }, [currentPage.id, lang]);

  return { displayContent, txStatus, noCredits, setNoCredits };
}

/**
 * Summary engine — purely explicit.
 * No auto-fetching on page change. Caller decides when to fetch and when to clear.
 */
function useSummaryEngine() {
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>("idle");

  const summaryCache = useRef<Map<string, string>>(new Map());
  const reqId = useRef(0);

  const fetchSummary = useCallback(
    async (page: Page, lang: string, onLimitReached: () => void) => {
      const key = `${page.id}:${lang === "none" ? "original" : lang}`;

      // Memory cache hit — instant
      if (summaryCache.current.has(key)) {
        setSummaryText(summaryCache.current.get(key)!);
        setSummaryStatus("idle");
        return;
      }

      const myId = ++reqId.current;
      setSummaryStatus("loading");
      setSummaryText(null);

      const res = await summarizePage(page.id, lang, page.content);
      if (myId !== reqId.current) return; // stale — user navigated away

      if (
        res.error === "DAILY_LIMIT_REACHED" ||
        res.error === "UPGRADE_REQUIRED"
      ) {
        onLimitReached();
        setSummaryStatus("error");
        return;
      }
      if (res.error || !res.summary) {
        setSummaryStatus("error");
        return;
      }

      summaryCache.current.set(key, res.summary);
      setSummaryText(res.summary);
      setSummaryStatus("idle");
    },
    [],
  );

  const clearSummary = useCallback(() => {
    reqId.current++; // cancel any in-flight request
    setSummaryText(null);
    setSummaryStatus("idle");
  }, []);

  return { summaryText, summaryStatus, fetchSummary, clearSummary };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function NavigationSidebar({
  book,
  theme,
  totalPages,
  currentPageNum,
  progress,
  goToPage,
}: {
  book: Book;
  theme: Theme;
  totalPages: number;
  currentPageNum: number;
  progress: number;
  goToPage: (n: number) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentPageNum]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" style={{ color: theme.muted }}>
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-70 p-0"
        style={{ backgroundColor: theme.bg, borderColor: theme.border }}
      >
        <SheetHeader
          className="p-4 border-b"
          style={{ borderColor: theme.border }}
        >
          <SheetTitle
            className="text-sm flex items-center gap-2 text-left"
            style={{ color: theme.text }}
          >
            <BookOpen
              className="w-4 h-4 shrink-0"
              style={{ color: theme.accent }}
            />
            <span className="truncate">{book.title}</span>
          </SheetTitle>
          {book.author && (
            <p
              className="text-xs"
              style={{ color: theme.muted, fontFamily: "Georgia, serif" }}
            >
              {book.author}
            </p>
          )}
          <div className="mt-2">
            <div
              className="flex justify-between text-[10px] mb-1"
              style={{ color: theme.muted }}
            >
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div
              className="h-1 rounded-full"
              style={{ backgroundColor: theme.border }}
            >
              <div
                className="h-1 rounded-full transition-all"
                style={{ width: `${progress}%`, backgroundColor: theme.accent }}
              />
            </div>
          </div>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-130px)]">
          <div className="p-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => {
              const active = num === currentPageNum;
              return (
                <button
                  key={num}
                  ref={active ? activeRef : undefined}
                  onClick={() => goToPage(num)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mb-px"
                  style={{
                    backgroundColor: active
                      ? `${theme.accent}18`
                      : "transparent",
                    color: active ? theme.accent : theme.muted,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  Page {num}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function SettingsPanel({
  theme,
  prefs,
  updatePref,
  prefetchEnabled,
  onPrefetchToggle,
}: {
  theme: Theme;
  prefs: Prefs;
  updatePref: <K extends keyof Prefs>(key: K, val: Prefs[K]) => void;
  prefetchEnabled: boolean;
  onPrefetchToggle: (enabled: boolean) => void;
}) {
  const fontSizeIdx = FONT_SIZES.indexOf(prefs.fontSize);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          style={{ color: theme.muted }}
        >
          <Settings2 className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-72 p-0"
        style={{ backgroundColor: theme.bg, borderColor: theme.border }}
      >
        <SheetHeader
          className="p-5 border-b"
          style={{ borderColor: theme.border }}
        >
          <SheetTitle
            className="text-sm flex items-center gap-2"
            style={{ color: theme.text }}
          >
            <Settings2 className="w-4 h-4" style={{ color: theme.accent }} />
            Reading Settings
          </SheetTitle>
        </SheetHeader>

        <div className="p-5 space-y-6">
          <div>
            <p
              className="text-[10px] font-semibold tracking-widest uppercase mb-3"
              style={{ color: theme.muted }}
            >
              Font Size
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() =>
                  fontSizeIdx > 0 &&
                  updatePref("fontSize", FONT_SIZES[fontSizeIdx - 1])
                }
                disabled={fontSizeIdx === 0}
                className="w-8 h-8 rounded-lg border flex items-center justify-center disabled:opacity-30"
                style={{ borderColor: theme.border, color: theme.text }}
              >
                <Minus className="w-3 h-3" />
              </button>
              <span
                className="flex-1 text-center text-sm font-medium"
                style={{ color: theme.text }}
              >
                {prefs.fontSize}px
              </span>
              <button
                onClick={() =>
                  fontSizeIdx < FONT_SIZES.length - 1 &&
                  updatePref("fontSize", FONT_SIZES[fontSizeIdx + 1])
                }
                disabled={fontSizeIdx === FONT_SIZES.length - 1}
                className="w-8 h-8 rounded-lg border flex items-center justify-center disabled:opacity-30"
                style={{ borderColor: theme.border, color: theme.text }}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          <Separator style={{ backgroundColor: theme.border }} />

          <div>
            <p
              className="text-[10px] font-semibold tracking-widest uppercase mb-3"
              style={{ color: theme.muted }}
            >
              Line Spacing
            </p>
            <div className="flex gap-2">
              {LINE_HEIGHTS.map((lh, i) => {
                const active = prefs.lineHeight === lh;
                return (
                  <button
                    key={lh}
                    onClick={() => updatePref("lineHeight", lh)}
                    className="flex-1 py-1.5 rounded-lg border text-xs transition-colors"
                    style={{
                      borderColor: active ? theme.accent : theme.border,
                      color: active ? theme.accent : theme.muted,
                      backgroundColor: active
                        ? `${theme.accent}15`
                        : "transparent",
                    }}
                  >
                    {["XS", "S", "M", "L", "XL"][i]}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator style={{ backgroundColor: theme.border }} />

          <div>
            <p
              className="text-[10px] font-semibold tracking-widest uppercase mb-1"
              style={{ color: theme.muted }}
            >
              Reading Width
            </p>
            <p
              className="text-[10px] mb-3"
              style={{ color: theme.muted, opacity: 0.6 }}
            >
              Max characters per line
            </p>
            <div className="flex gap-2">
              {Object.entries(LINE_WIDTHS).map(([key, _value], i) => {
                const active = prefs.lineWidth === key;
                return (
                  <button
                    key={key}
                    onClick={() => updatePref("lineWidth", key)}
                    className="flex-1 py-1.5 rounded-lg border text-xs transition-colors"
                    style={{
                      borderColor: active ? theme.accent : theme.border,
                      color: active ? theme.accent : theme.muted,
                      backgroundColor: active
                        ? `${theme.accent}15`
                        : "transparent",
                    }}
                  >
                    {["S", "M", "L", "XL"][i]}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator style={{ backgroundColor: theme.border }} />

          <div>
            <p
              className="text-[10px] font-semibold tracking-widest uppercase mb-4"
              style={{ color: theme.muted }}
            >
              Theme
            </p>
            <div className="grid grid-cols-5 gap-3">
              {THEMES.map((t) => {
                const active = prefs.themeId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => updatePref("themeId", t.id)}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div
                      className="w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all"
                      style={{
                        backgroundColor: t.bg,
                        borderColor: active ? t.accent : t.border,
                        boxShadow: active ? `0 0 0 3px ${t.accent}30` : "none",
                      }}
                    >
                      <div className="space-y-1">
                        <div
                          className="w-4 h-0.5 rounded-full"
                          style={{ backgroundColor: t.text }}
                        />
                        <div
                          className="w-3 h-0.5 rounded-full"
                          style={{ backgroundColor: t.muted }}
                        />
                      </div>
                    </div>
                    <span
                      className="text-[10px]"
                      style={{ color: active ? theme.accent : theme.muted }}
                    >
                      {t.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator style={{ backgroundColor: theme.border }} />

          <div>
            <p
              className="text-[10px] font-semibold tracking-widest uppercase mb-3"
              style={{ color: theme.muted }}
            >
              Keyboard
            </p>
            <div className="space-y-2">
              {[
                ["← / h", "Previous page"],
                ["→ / l", "Next page"],
              ].map(([k, d]) => (
                <div key={k} className="flex items-center justify-between">
                  <code
                    className="text-xs px-1.5 py-0.5 rounded font-mono"
                    style={{ backgroundColor: theme.card, color: theme.muted }}
                  >
                    {k}
                  </code>
                  <span className="text-xs" style={{ color: theme.muted }}>
                    {d}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Separator style={{ backgroundColor: theme.border }} />

          <div>
            <p
              className="text-[10px] font-semibold tracking-widest uppercase mb-3"
              style={{ color: theme.muted }}
            >
              Performance
            </p>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: theme.text }}
                >
                  Smart Prefetch
                </p>
                <p
                  className="text-xs mt-1 leading-relaxed"
                  style={{ color: theme.muted }}
                >
                  Pre-translates the next page while you read. Uses 1 extra
                  credit per page.
                </p>
              </div>
              <Switch
                checked={prefetchEnabled}
                onCheckedChange={onPrefetchToggle}
                className="shrink-0 mt-0.5"
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TranslationStatusBadge({
  txStatus,
  lang,
  theme,
}: {
  txStatus: TxStatus;
  lang: string;
  theme: Theme;
}) {
  if (lang === "none" || txStatus === "idle") return null;
  const activeLang = LANGUAGES.find((l) => l.code === lang);
  return (
    <div className="flex items-center gap-2 mb-8">
      {txStatus === "waiting" && (
        <span
          className="flex items-center gap-1.5 text-xs"
          style={{ color: theme.muted }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full inline-block"
            style={{ backgroundColor: theme.muted }}
          />
          Reading...
        </span>
      )}
      {txStatus === "translating" && (
        <span
          className="flex items-center gap-1.5 text-xs"
          style={{ color: theme.muted }}
        >
          <Sparkles
            className="w-3 h-3 animate-spin"
            style={{ color: theme.accent }}
          />
          Translating to {activeLang?.label}...
        </span>
      )}
      {txStatus === "prefetching" && (
        <span
          className="flex items-center gap-1.5 text-xs"
          style={{ color: theme.muted }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse inline-block"
            style={{ backgroundColor: theme.muted }}
          />
          Preparing next page
        </span>
      )}
      {txStatus === "rate_limited" && (
        <span
          className="flex items-center gap-1.5 text-xs"
          style={{ color: theme.muted }}
        >
          <Clock className="w-3 h-3" />
          Translation paused — resuming shortly
        </span>
      )}
      {txStatus === "error" && (
        <span className="text-xs text-red-400">
          Translation unavailable — showing original
        </span>
      )}
    </div>
  );
}

/**
 * Desktop floating summary panel.
 * Stays fixed over the reading area — content never shifts.
 * X button appears on hover.
 */
function DesktopSummaryPanel({
  theme,
  summaryText,
  summaryStatus,
  isOpen,
  onClose,
  lang,
}: {
  theme: Theme;
  summaryText: string | null;
  summaryStatus: SummaryStatus;
  isOpen: boolean;
  onClose: () => void;
  lang: string;
}) {
  const activeLang = LANGUAGES.find((l) => l.code === lang);
  const langLabel = lang === "none" ? "Original language" : activeLang?.label;

  return (
    <div
      className="fixed top-[4.5rem] right-4 bottom-4 w-[320px] lg:w-105 z-40 rounded-2xl overflow-hidden group"
      style={{
        // Cinematic Apple-style spring entrance
        transform: isOpen
          ? "translateY(0) scale(1)"
          : "translateY(16px) scale(0.97)",
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? "auto" : "none",
        transition:
          "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        backgroundColor: theme.card,
        border: `1px solid ${theme.border}`,
        boxShadow:
          "0 32px 64px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.04)",
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pt-5 pb-4"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${theme.accent}20` }}
          >
            <Wand2 className="w-3.5 h-3.5" style={{ color: theme.accent }} />
          </div>
          <div>
            <p
              className="text-xs font-semibold leading-tight"
              style={{ color: theme.text }}
            >
              Page Summary
            </p>
            {lang !== "none" && (
              <p
                className="text-[10px] leading-tight mt-px"
                style={{ color: theme.muted }}
              >
                {langLabel}
              </p>
            )}
          </div>
        </div>

        {/* X — invisible until panel is hovered */}
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200
                     opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95"
          style={{ backgroundColor: `${theme.muted}18`, color: theme.muted }}
          title="Close summary"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <ScrollArea className="h-[calc(100%-60px)]">
        <div className="px-5 py-5">
          {summaryStatus === "loading" && (
            <div className="space-y-3">
              {SUMMARY_SKELETON_WIDTHS.map((w, i) => (
                <Skeleton
                  key={i}
                  className="h-3.5 rounded-md"
                  style={{ width: w, backgroundColor: `${theme.muted}20` }}
                />
              ))}
              <p className="text-[11px] mt-4" style={{ color: theme.muted }}>
                Generating summary...
              </p>
            </div>
          )}

          {summaryStatus === "error" && (
            <div className="flex flex-col items-center text-center gap-3 py-8">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${theme.accent}15` }}
              >
                <Wand2 className="w-5 h-5" style={{ color: theme.accent }} />
              </div>
              <p className="text-sm font-medium" style={{ color: theme.text }}>
                Couldn't generate summary
              </p>
              <p
                className="text-xs leading-relaxed"
                style={{ color: theme.muted }}
              >
                Check your daily limit or try again.
              </p>
            </div>
          )}

          {summaryStatus === "idle" && summaryText && (
            <p
              className="text-sm leading-[1.75]"
              style={{
                color: theme.text,
                fontFamily: "Georgia, 'Times New Roman', serif",
                letterSpacing: "0.01em",
              }}
            >
              {summaryText}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * Mobile summary panel — expands inline below the article.
 * Uses CSS grid animation so it's smooth without JS height measurement.
 */
function MobileSummaryPanel({
  theme,
  summaryText,
  summaryStatus,
  isOpen,
  onClose,
  lang,
}: {
  theme: Theme;
  summaryText: string | null;
  summaryStatus: SummaryStatus;
  isOpen: boolean;
  onClose: () => void;
  lang: string;
}) {
  const activeLang = LANGUAGES.find((l) => l.code === lang);
  const langLabel = lang === "none" ? "Original" : activeLang?.label;

  return (
    <div
      className="grid transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
      style={{
        gridTemplateRows: isOpen ? "1fr" : "0fr",
        marginTop: isOpen ? "2rem" : "0",
      }}
    >
      <div className="overflow-hidden">
        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.border,
            boxShadow: "0 8px 24px -4px rgba(0,0,0,0.12)",
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4" style={{ color: theme.accent }} />
              <span
                className="text-xs font-semibold"
                style={{ color: theme.text }}
              >
                Page Summary {lang !== "none" && `· ${langLabel}`}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
              style={{
                backgroundColor: `${theme.muted}15`,
                color: theme.muted,
              }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-4 py-4">
            {summaryStatus === "loading" && (
              <div className="space-y-2.5">
                {SUMMARY_SKELETON_WIDTHS.map((w, i) => (
                  <Skeleton
                    key={i}
                    className="h-3.5 rounded"
                    style={{ width: w, backgroundColor: `${theme.muted}20` }}
                  />
                ))}
              </div>
            )}
            {summaryStatus === "error" && (
              <p className="text-xs text-red-400">
                Failed to generate summary.
              </p>
            )}
            {summaryStatus === "idle" && summaryText && (
              <p
                className="text-sm leading-[1.75]"
                style={{ color: theme.text, fontFamily: "Georgia, serif" }}
              >
                {summaryText}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NoCreditsDialog({
  open,
  onClose,
  theme,
  updatePref,
}: {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  updatePref: <K extends keyof Prefs>(key: K, val: Prefs[K]) => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Daily limit reached</AlertDialogTitle>
          <AlertDialogDescription>
            You've used all your translation pages for today. Your limit resets
            at midnight — or upgrade to Pro for 3× more pages per day.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              updatePref("lang", "none");
              onClose();
            }}
          >
            Read original
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => (window.location.href = "/billing")}
          >
            Upgrade to Pro
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function ReaderClient({
  book,
  initialPage,
  totalPages,
  initialPrefetchEnabled,
}: {
  book: Book;
  initialPage: Page;
  totalPages: number;
  initialCredits: number;
  initialPrefetchEnabled: boolean;
}) {
  const { prefs, updatePref } = useReaderPrefs();
  const theme = THEMES.find((t) => t.id === prefs.themeId) ?? THEMES[0];

  const [prefetchEnabled, setPrefetchEnabled] = useState(
    initialPrefetchEnabled,
  );
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  const handlePrefetchToggle = useCallback((enabled: boolean) => {
    setPrefetchEnabled(enabled);
    togglePrefetch(enabled);
  }, []);

  const { currentPage, isNavigating, goToPage, pageCache, currentPageRef } =
    usePageNavigation(book, initialPage, totalPages);

  const { displayContent, txStatus, noCredits, setNoCredits } =
    useTranslationEngine(
      currentPage,
      prefs.lang,
      book,
      totalPages,
      pageCache,
      currentPageRef,
      prefetchEnabled,
    );

  const { summaryText, summaryStatus, fetchSummary, clearSummary } =
    useSummaryEngine();

  // Close and clear summary whenever the user navigates to a different page
  useEffect(() => {
    setIsSummaryOpen(false);
    clearSummary();
  }, [currentPage.id, clearSummary]);

  // Wand button — always opens and fetches (never toggles)
  const handleSummarize = useCallback(() => {
    setIsSummaryOpen(true);
    fetchSummary(currentPage, prefs.lang, () => setNoCredits(true));
  }, [currentPage, prefs.lang, fetchSummary, setNoCredits]);

  const handleSummaryClose = useCallback(() => {
    setIsSummaryOpen(false);
    clearSummary();
  }, [clearSummary]);

  const progress = (currentPage.page_number / totalPages) * 100;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{
        backgroundColor: theme.bg,
        color: theme.text,
        transition: "background-color 0.3s, color 0.3s",
      }}
    >
      {/* ── Header ── */}
      <header
        className="shrink-0 flex items-center gap-2 px-4 h-14 border-b z-50"
        style={{ backgroundColor: theme.bg, borderColor: theme.border }}
      >
        <NavigationSidebar
          book={book}
          theme={theme}
          totalPages={totalPages}
          currentPageNum={currentPage.page_number}
          progress={progress}
          goToPage={goToPage}
        />

        <h1
          className="flex-1 text-sm font-semibold truncate text-center"
          style={{ color: theme.text, fontFamily: "Georgia, serif" }}
        >
          {book.title}
        </h1>

        <div className="flex items-center gap-1">
          <Select
            value={prefs.lang}
            onValueChange={(v) => updatePref("lang", v)}
            disabled={txStatus === "translating"}
          >
            <SelectTrigger
              className="border border-border"
              style={{ color: theme.muted, backgroundColor: "transparent" }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="p-2">
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 ml-1 transition-all duration-200"
            onClick={handleSummarize}
            style={{
              color: isSummaryOpen ? theme.accent : theme.muted,
              backgroundColor: isSummaryOpen
                ? `${theme.accent}15`
                : "transparent",
            }}
            title="Summarize this page"
          >
            <Wand2 className="w-4 h-4" />
          </Button>

          <SettingsPanel
            theme={theme}
            prefs={prefs}
            updatePref={updatePref}
            prefetchEnabled={prefetchEnabled}
            onPrefetchToggle={handlePrefetchToggle}
          />
        </div>
      </header>

      {/* ── Progress bar ── */}
      <div
        className="shrink-0 h-px w-full"
        style={{ backgroundColor: theme.border }}
      >
        <div
          className="h-px transition-all duration-500"
          style={{ width: `${progress}%`, backgroundColor: theme.accent }}
        />
      </div>

      {/* ── Scrollable reading area ──
        flex-1 + overflow-y-auto = the ONLY thing that scrolls.
        Works regardless of what the parent layout does.
    ── */}
      <main className="flex-1 overflow-y-auto">
        <div
          className="px-6 pt-12 pb-8 md:pt-20 mx-auto w-full"
          style={{ maxWidth: LINE_WIDTHS[prefs.lineWidth] ?? "48rem" }}
        >
          <TranslationStatusBadge
            txStatus={txStatus}
            lang={prefs.lang}
            theme={theme}
          />

          {txStatus === "translating" ? (
            <div className="space-y-4 animate-pulse">
              {SKELETON_WIDTHS.map((w, i) => (
                <Skeleton
                  key={i}
                  className="h-4"
                  style={{ width: w, backgroundColor: `${theme.muted}20` }}
                />
              ))}
            </div>
          ) : (
            <article
              className={
                isSummaryOpen && summaryStatus === "loading"
                  ? "animate-pulse"
                  : ""
              }
              style={{
                fontSize: `${prefs.fontSize}px`,
                lineHeight: prefs.lineHeight,
                color: theme.text,
                fontFamily: "Georgia, 'Times New Roman', serif",
                letterSpacing: "0.01em",
                whiteSpace: "pre-wrap",
                opacity:
                  isSummaryOpen && summaryStatus === "loading"
                    ? 0.35
                    : isNavigating
                      ? 0.3
                      : 1,
                transition: "opacity 0.15s ease",
              }}
            >
              {displayContent}
            </article>
          )}

          {/* Mobile summary — inline below article */}
          <div className="lg:hidden">
            <MobileSummaryPanel
              theme={theme}
              summaryText={summaryText}
              summaryStatus={summaryStatus}
              isOpen={isSummaryOpen}
              onClose={handleSummaryClose}
              lang={prefs.lang}
            />
          </div>
        </div>
      </main>

      {/* ── Footer — shrink-0 keeps it pinned at bottom of the flex column ── */}
      <footer
        className="shrink-0 h-16 flex items-center justify-between px-6 border-t"
        style={{ backgroundColor: theme.bg, borderColor: theme.border }}
      >
        <Button
          variant="ghost"
          disabled={currentPage.page_number <= 1 || isNavigating}
          onClick={() => goToPage(currentPage.page_number - 1)}
          className="gap-2 rounded-xl"
          style={{ color: theme.muted }}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline text-sm">Previous</span>
        </Button>

        <span
          className="text-xs font-medium tabular-nums"
          style={{ color: theme.muted }}
        >
          {currentPage.page_number} / {totalPages}
        </span>

        <Button
          variant="ghost"
          disabled={currentPage.page_number >= totalPages || isNavigating}
          onClick={() => goToPage(currentPage.page_number + 1)}
          className="gap-2 rounded-xl"
          style={{ color: theme.muted }}
        >
          <span className="hidden sm:inline text-sm">Next</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </footer>

      {/* ── Desktop floating summary panel ── */}
      <div className="hidden lg:block">
        <DesktopSummaryPanel
          theme={theme}
          summaryText={summaryText}
          summaryStatus={summaryStatus}
          isOpen={isSummaryOpen}
          onClose={handleSummaryClose}
          lang={prefs.lang}
        />
      </div>

      <NoCreditsDialog
        open={noCredits}
        onClose={() => setNoCredits(false)}
        theme={theme}
        updatePref={updatePref}
      />
    </div>
  );
}
