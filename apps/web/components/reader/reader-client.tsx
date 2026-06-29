"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { saveReadingProgress, togglePrefetch } from "@/lib/actions/translate";
import {
  Menu, Settings2, ChevronLeft, ChevronRight, Sparkles, BookOpen,
  Plus, Minus, Clock, Wand2, X, Headphones, Play, Pause,
  RotateCcw, SkipForward, RotateCw, SkipBack, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";

const THEMES = [
  { id: "paper", name: "Paper", bg: "#faf8f4", text: "#2c2417", muted: "#9c8c78", border: "#e8e0d0", accent: "#8b6f47", card: "#f2ede4" },
  { id: "white", name: "White", bg: "#ffffff", text: "#1a1a1a", muted: "#71717a", border: "#e4e4e7", accent: "#6366f1", card: "#f4f4f5" },
  { id: "dark", name: "Dark", bg: "#18181b", text: "#e4e4e7", muted: "#71717a", border: "#27272a", accent: "#a78bfa", card: "#1f1f23" },
  { id: "oled", name: "OLED", bg: "#000000", text: "#ffffff", muted: "#71717a", border: "#18181b", accent: "#818cf8", card: "#0a0a0a" },
  { id: "forest", name: "Forest", bg: "#141f14", text: "#c8dfc8", muted: "#6a8f6a", border: "#1f321f", accent: "#4ade80", card: "#0e170e" },
] as const;

const LANGUAGES = [
  { code: "none", label: "Original" }, { code: "Bengali", label: "বাংলা" },
  { code: "Spanish", label: "Español" }, { code: "French", label: "Français" },
  { code: "Arabic", label: "العربية" }, { code: "Hindi", label: "हिन्दी" },
  { code: "Portuguese", label: "Português" }, { code: "Russian", label: "Русский" },
  { code: "Japanese", label: "日本語" }, { code: "German", label: "Deutsch" },
  { code: "Chinese", label: "中文" }, { code: "Turkish", label: "Türkçe" },
  { code: "Korean", label: "한국어" }, { code: "Italian", label: "Italiano" },
];

const FONT_SIZES = [13, 14, 15, 16, 17, 18, 20, 22, 24];
const LINE_HEIGHTS = [1.4, 1.6, 1.8, 2.0, 2.4];
const LINE_WIDTHS: Record<string, string> = { "2xl": "42rem", "3xl": "48rem", "4xl": "56rem", "5xl": "64rem" };
const SUMMARY_SKELETON_WIDTHS = ["88%", "94%", "79%", "91%", "85%", "72%"];

const PREFS_KEY = "glintpage_reader_v1";
const SETTLE_DELAY_MS = 1200;
const PREFETCH_DELAY_MS = 3500;
const MIN_AI_GAP_MS = 2000;

type Theme = (typeof THEMES)[number];
type Page = {
  id: string; page_number: number; content: string; chapter_number: number;
  chapter_title: string; render_type?: "markdown" | "epub_xhtml" | "pdf_image" | null;
  render_content?: string | null; ai_text?: string | null; asset_manifest?: Record<string, string> | null;
};
export type ChapterTOC = { chapter_number: number; chapter_title: string; first_page: number; last_page: number; };
type Book = { id: string; title: string; author: string | null; cover_url: string | null; page_count: number; };
type Prefs = { themeId: string; fontSize: number; lineHeight: number; lineWidth: string; lang: string; };
type TxStatus = "idle" | "waiting" | "translating" | "prefetching" | "rate_limited" | "error" | "no_credits";
type SummaryStatus = "idle" | "loading" | "error";
type AudioStatus = "idle" | "loading" | "playing" | "paused" | "error" | "no_credits" | "upgrade_required" | "translation_required";

const DEFAULT_PREFS: Prefs = { themeId: "paper", fontSize: 17, lineHeight: 1.8, lineWidth: "3xl", lang: "none" };

function MarkdownImage({ src, alt, title, eager = false, className = "" }: { src?: string; alt?: string; title?: string; eager?: boolean; className?: string; }) {
  if (!src) return null;
  const imageSrc = getReaderImageSrc(src);
  return (
    <span className="my-6 block text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageSrc} alt={alt || ""} title={title} crossOrigin="anonymous" referrerPolicy="no-referrer" loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} decoding="async" className={`mx-auto h-auto max-w-full rounded-sm object-contain ${className}`} style={{ display: "block" }} onError={(e) => (e.currentTarget.style.display = "none")} />
      {alt ? <span className="mt-2 block text-center text-xs italic opacity-60">{alt}</span> : null}
    </span>
  );
}

function getReaderImageSrc(src: string) {
  try {
    const url = new URL(src);
    if (url.hostname.endsWith(".supabase.co")) return `/api/book_asset?url=${encodeURIComponent(url.toString())}`;
  } catch {}
  return src;
}

function getOriginalDisplayContent(page: Page) {
  if ((page.render_type === "epub_xhtml" || page.render_type === "pdf_image") && page.render_content) return page.render_content;
  return page.content;
}

function extractReaderImageUrls(content: string) {
  const urls = new Set<string>();
  const md = String(content || "").matchAll(/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g);
  for (const m of md) urls.add(m[1]);
  const html = String(content || "").matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi);
  for (const m of html) urls.add(m[1]);
  return [...urls].map(getReaderImageSrc);
}

function preloadReaderImages(content: string) {
  if (typeof window === "undefined") return;
  for (const src of extractReaderImageUrls(content)) {
    const img = new window.Image();
    img.crossOrigin = "anonymous"; img.referrerPolicy = "no-referrer"; img.decoding = "async"; img.src = src;
  }
}

async function readJsonLineStream(response: Response, onEvent: (e: Record<string, unknown>) => void) {
  if (!response.body) throw new Error("Streaming response unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.trim()) {
        try {
          onEvent(JSON.parse(line));
        } catch (e) {
          console.error("Failed to parse stream JSON line:", line, e);
        }
      }
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) {
    try {
      onEvent(JSON.parse(buffer));
    } catch (e) {
      console.error("Failed to parse stream JSON buffer:", buffer, e);
    }
  }
}

function prepareEpubHtml(html: string) {
  return html
    .replace(/(src|href)=["'](https:\/\/[^"']+?\.supabase\.co\/[^"']+)["']/g, (_m, attr: string, url: string) => `${attr}="${getReaderImageSrc(url)}"`)
    .replace(/url\((["']?)(https:\/\/[^"')]+?\.supabase\.co\/[^"')]+)\1\)/g, (_m, _q: string, url: string) => `url("${getReaderImageSrc(url)}")`);
}

function SummaryBody({ text, theme, className = "" }: { text: string; theme: Theme; className?: string; }) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className={`space-y-3 ${className}`} style={{ color: theme.text, fontFamily: "Georgia, 'Times New Roman', serif" }}>
      {paragraphs.map((p, i) => (
        <p key={`${i}-${p.slice(0, 16)}`} className="summary-stream-paragraph text-sm leading-[1.75]" style={{ animationDelay: `${Math.min(i * 70, 420)}ms` }}>{p}</p>
      ))}
    </div>
  );
}

function TranslationShimmer({ theme }: { theme: Theme }) {
  const widths = ["92%", "81%", "96%", "74%", "88%", "94%", "79%", "98%"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-sm">
      <div className="space-y-4 pt-1">
        {widths.map((w, i) => (
          <div key={`${w}-${i}`} className="reader-translation-shimmer h-3 rounded-full" style={{ width: w, "--shimmer-accent": theme.accent, "--shimmer-muted": theme.muted, animationDelay: `${i * 95}ms` } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}

function EpubXhtmlRenderer({ html, theme, fontSize, lineHeight, onNavigateToPage }: { html: string; theme: Theme; fontSize: number; lineHeight: number; onNavigateToPage: (n: number) => void; }) {
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    const anchor = target?.closest("a[data-gp-page-number]");
    if (!anchor) return;
    const pageNum = Number(anchor.getAttribute("data-gp-page-number"));
    if (!Number.isFinite(pageNum) || pageNum < 1) return;
    e.preventDefault();
    onNavigateToPage(pageNum);
  }, [onNavigateToPage]);

  return (
    <div className="epub-renderer" onClick={handleClick} style={{ "--epub-text": theme.text, "--epub-muted": theme.muted, "--epub-link": theme.accent, "--epub-font-size": `${fontSize}px`, "--epub-line-height": lineHeight } as React.CSSProperties} dangerouslySetInnerHTML={{ __html: prepareEpubHtml(html) }} />
  );
}

// ─── HOOKS ───────────────────────────────────────────────────────────────────

function useReaderPrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {}
  }, []);
  const updatePref = useCallback(<K extends keyof Prefs>(key: K, val: Prefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: val };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  return { prefs, updatePref };
}

function usePageNavigation(book: Book, initialPage: Page, totalPages: number, isAuthenticated: boolean, isAudiobookMode: boolean) {
  const [currentPage, setCurrentPage] = useState<Page>(initialPage);
  const [isNavigating, setIsNavigating] = useState(false);
  const pageCache = useRef<Map<number, Page>>(new Map([[initialPage.page_number, initialPage]]));
  const isNavigatingRef = useRef(false);
  const currentPageRef = useRef(currentPage);

  const fetchPage = useCallback(async (num: number) => {
    const cached = pageCache.current.get(num);
    if (cached) return cached;
    const res = await fetch(`/api/book_page?bookId=${book.id}&pageNumber=${num}`);
    const data = await res.json();
    if (!data.page) return null;
    pageCache.current.set(num, data.page);
    return data.page as Page;
  }, [book.id]);

  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  const goToPage = useCallback(async (num: number) => {
    if (num < 1 || num > totalPages || isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setIsNavigating(true);
    let page: Page | null = null;
    try { page = await fetchPage(num); } catch { isNavigatingRef.current = false; setIsNavigating(false); return; }
    
    if (page) {
      setCurrentPage(page);
      if (isAuthenticated) {
        saveReadingProgress(book.id, page.page_number, (page.page_number / totalPages) * 100);
      }
    }
    
    isNavigatingRef.current = false;
    setIsNavigating(false);
  }, [fetchPage, totalPages, isAuthenticated, book.id]);

  const manualGoToPage = useCallback((num: number) => {
    if (isAudiobookMode) return;
    goToPage(num);
  }, [isAudiobookMode, goToPage]);

  useEffect(() => {
    preloadReaderImages(getOriginalDisplayContent(currentPage));
    for (const num of [currentPage.page_number + 1, currentPage.page_number - 1]) {
      if (num < 1 || num > totalPages || pageCache.current.has(num)) continue;
      fetchPage(num).then((p) => { if (p) preloadReaderImages(getOriginalDisplayContent(p)); }).catch(() => {});
    }
  }, [currentPage, fetchPage, totalPages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "ArrowRight" || e.key === "l") { e.preventDefault(); manualGoToPage(currentPageRef.current.page_number + 1); }
      if (e.key === "ArrowLeft" || e.key === "h") { e.preventDefault(); manualGoToPage(currentPageRef.current.page_number - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [manualGoToPage]);

  return { currentPage, isNavigating, goToPage, manualGoToPage, pageCache, currentPageRef, fetchPage };
}

function useTranslationEngine(
  currentPage: Page, lang: string, book: Book, totalPages: number,
  pageCache: React.MutableRefObject<Map<number, Page>>, currentPageRef: React.MutableRefObject<Page>, prefetchEnabled: boolean,
  onLimitReached: () => void,
  onPrefetchSuccess: (pageId: string) => void,
  setTxStatus: (status: TxStatus) => void
) {
  const [displayContent, setDisplay] = useState(getOriginalDisplayContent(currentPage));
  const prefetchEnabledRef = useRef(prefetchEnabled);
  const txCache = useRef<Map<string, string>>(new Map());
  const requestId = useRef(0);
  const lastAICallTime = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const langRef = useRef(lang);

  useEffect(() => { prefetchEnabledRef.current = prefetchEnabled; }, [prefetchEnabled]);
  useEffect(() => { langRef.current = lang; }, [lang]);

  const callTranslate = useCallback(async (page: Page, targetLang: string, previousContext?: string): Promise<string | null> => {
    const myId = ++requestId.current;
    const elapsed = Date.now() - lastAICallTime.current;
    if (elapsed < MIN_AI_GAP_MS) await new Promise((r) => setTimeout(r, MIN_AI_GAP_MS - elapsed));
    if (myId !== requestId.current) return null;

    try {
      const res = await fetch("/api/translate/stream", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: page.id, languageCode: targetLang, previousContext }),
      });
      if (myId !== requestId.current) return null;
      if (!res.ok) { setTxStatus("error"); return null; }

      lastAICallTime.current = Date.now();
      let translation: string | null = null;
      let streamError = "";

      await readJsonLineStream(res, (event) => {
        if (myId !== requestId.current) return;
        if (event.type === "error") streamError = String(event.error || "error");
        if (event.type === "final" || event.type === "translation") translation = String(event.translation || event.text || "");
      });

      if (streamError === "DAILY_LIMIT_REACHED" || streamError.includes("Not enough credits")) {
        onLimitReached(); setTxStatus("no_credits"); return null;
      }
      if (streamError === "RATE_LIMITED") { setTxStatus("rate_limited"); return null; }
      if (streamError || !translation) { setTxStatus("error"); return null; }
      return translation;
    } catch (err) {
      console.error("Translation stream failed:", err);
      setTxStatus("error");
      return null;
    }
  }, [onLimitReached, setTxStatus]);

  const runTranslation = useCallback(async (page: Page, targetLang: string, previousContext?: string) => {
    if (targetLang === "none") { setDisplay(getOriginalDisplayContent(page)); setTxStatus("idle"); return getOriginalDisplayContent(page); }
    const cacheKey = `${page.id}:${targetLang}`;
    if (txCache.current.has(cacheKey)) {
      const cachedText = txCache.current.get(cacheKey)!;
      setDisplay(cachedText); setTxStatus("idle"); return cachedText;
    }
    setTxStatus("translating");
    const text = await callTranslate(page, targetLang, previousContext);
    if (currentPageRef.current.id !== page.id || langRef.current !== targetLang) return null;
    if (!text) { setDisplay(getOriginalDisplayContent(page)); return null; }
    txCache.current.set(cacheKey, text);
    setDisplay(text); setTxStatus("idle"); return text;
  }, [callTranslate, currentPageRef, setTxStatus]);

  const schedulePrefetch = useCallback((afterPage: Page, targetLang: string, previousContext?: string) => {
    clearTimeout(prefetchTimer.current);
    if (!prefetchEnabledRef.current || targetLang === "none" || afterPage.page_number >= totalPages) return;
    const nextNum = afterPage.page_number + 1;

    prefetchTimer.current = setTimeout(async () => {
      if (!prefetchEnabledRef.current || currentPageRef.current.id !== afterPage.id || langRef.current !== targetLang) return;
      let nextPage = pageCache.current.get(nextNum);
      if (!nextPage) {
        try {
          const res = await fetch(`/api/book_page?bookId=${book.id}&pageNumber=${nextNum}`);
          const data = await res.json();
          if (data.page) { nextPage = data.page; pageCache.current.set(nextNum, data.page); }
        } catch { return; }
      }
      if (!nextPage) return;
      const cacheKey = `${nextPage.id}:${targetLang}`;
      if (txCache.current.has(cacheKey) || !prefetchEnabledRef.current || currentPageRef.current.id !== afterPage.id || langRef.current !== targetLang) return;

      setTxStatus("prefetching");
      const text = await callTranslate(nextPage, targetLang, previousContext);
      if (text) {
        txCache.current.set(cacheKey, text);
        onPrefetchSuccess(nextPage.id);
      }
      if (currentPageRef.current.id === afterPage.id) setTxStatus("idle");
    }, PREFETCH_DELAY_MS);
  }, [book.id, totalPages, callTranslate, pageCache, currentPageRef, onPrefetchSuccess, setTxStatus]);

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    clearTimeout(prefetchTimer.current);
    requestId.current++;
    setDisplay(getOriginalDisplayContent(currentPage));

    if (lang !== "none" && txCache.current.has(`${currentPage.id}:${lang}`)) {
      setDisplay(txCache.current.get(`${currentPage.id}:${lang}`)!);
      setTxStatus("idle");
      schedulePrefetch(currentPage, lang, txCache.current.get(`${currentPage.id}:${lang}`));
      return;
    }
    if (lang === "none") { setDisplay(getOriginalDisplayContent(currentPage)); setTxStatus("idle"); return; }

    setTxStatus("waiting");
    debounceTimer.current = setTimeout(async () => {
      const translatedText = await runTranslation(currentPage, lang);
      if (translatedText) schedulePrefetch(currentPage, lang, translatedText);
    }, SETTLE_DELAY_MS);

    return () => { clearTimeout(debounceTimer.current); clearTimeout(prefetchTimer.current); };
  }, [currentPage, lang, runTranslation, schedulePrefetch, setTxStatus]);

  return { displayContent };
}

function useSummaryEngine(book: Book, toc: ChapterTOC[], onLimitReached: () => void) {
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>("idle");
  const summaryCache = useRef<Map<string, string>>(new Map());
  const reqId = useRef(0);

  const fetchSummary = useCallback(async (page: Page, lang: string) => {
    const isPdfPage = page.render_type === "pdf_image";
    const chapter = isPdfPage ? { chapter_number: page.page_number, chapter_title: `Page ${page.page_number}`, first_page: page.page_number, last_page: page.page_number }
      : toc.find((c) => page.page_number >= c.first_page && page.page_number <= c.last_page) || { chapter_number: page.chapter_number, chapter_title: page.chapter_title, first_page: page.page_number, last_page: page.page_number };
    const scope = isPdfPage ? "page" : "chapter";
    const key = `${book.id}:${scope}:${chapter.chapter_number}:${chapter.first_page}-${chapter.last_page}:${lang === "none" ? "original" : lang}`;

    if (summaryCache.current.has(key)) { setSummaryText(summaryCache.current.get(key)!); setSummaryStatus("idle"); return; }

    const myId = ++reqId.current;
    setSummaryStatus("loading"); setSummaryText("");

    try {
      const res = await fetch("/api/summary/chapter/stream", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id, chapterNumber: chapter.chapter_number, chapterTitle: chapter.chapter_title, languageCode: lang, firstPage: chapter.first_page, lastPage: chapter.last_page, summaryScope: scope }),
      });
      if (myId !== reqId.current) return;
      if (!res.ok) { setSummaryStatus("error"); return; }

      let summary: string | null = null;
      let summaryError = "";
      let streamedText = "";

      await readJsonLineStream(res, (event) => {
        if (myId !== reqId.current) return;
        if (event.type === "error") summaryError = String(event.error || "error");
        if (event.type === "delta") { streamedText += String(event.delta || ""); setSummaryText(streamedText); }
        if (event.type === "final") summary = String(event.summary || "");
      });

      if (myId !== reqId.current) return;
      if (summaryError === "DAILY_LIMIT_REACHED" || summaryError === "UPGRADE_REQUIRED") { onLimitReached(); setSummaryStatus("error"); return; }
      if (summaryError || !summary) { setSummaryStatus("error"); return; }

      summaryCache.current.set(key, summary);
      setSummaryText(summary); setSummaryStatus("idle");
    } catch {
      if (myId === reqId.current) setSummaryStatus("error");
    }
  }, [book.id, toc, onLimitReached]);

  const clearSummary = useCallback(() => { reqId.current++; setSummaryText(null); setSummaryStatus("idle"); }, []);
  return { summaryText, summaryStatus, fetchSummary, clearSummary };
}

function useAudioEngine(
  currentPage: Page, 
  lang: string, 
  txStatus: TxStatus,
  onLimitReached: () => void,
  isAudiobookMode: boolean,
  goToNextPage: () => void
) {
  const [status, setStatus] = useState<AudioStatus>("idle");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [canUseAdvancedControls, setCanUseAdvancedControls] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const requestIdRef = useRef(0);
  const isGeneratingRef = useRef(false);
  const isAudiobookModeRef = useRef(isAudiobookMode);

  useEffect(() => { isAudiobookModeRef.current = isAudiobookMode; }, [isAudiobookMode]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current.onloadedmetadata = null;
      audioRef.current.ondurationchange = null;
      audioRef.current.ontimeupdate = null;
      audioRef.current.onprogress = null;
      audioRef.current.onloadeddata = null;
      audioRef.current.oncanplay = null;
      audioRef.current.oncanplaythrough = null;
      audioRef.current.onplay = null;
      audioRef.current.onpause = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    isGeneratingRef.current = false;
    setStatus("idle");
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setCanUseAdvancedControls(false);
  }, [currentPage.id, lang]);

  useEffect(() => {
    cacheRef.current.clear();
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, [lang]);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const mountAudio = useCallback((url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.playbackRate = playbackRate;
    audioRef.current = audio;

    const syncSeekability = () => {
      const hasFinite = Number.isFinite(audio.duration) && audio.duration > 0;
      const hasRange = audio.seekable.length > 0;
      setDuration(hasFinite ? audio.duration : 0);
      if (hasFinite && hasRange) setCanUseAdvancedControls(true);
    };

    audio.onloadedmetadata = syncSeekability;
    audio.ondurationchange = syncSeekability;
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onprogress = syncSeekability;
    audio.onloadeddata = syncSeekability;
    audio.oncanplay = () => { syncSeekability(); if (audio.paused) setStatus("paused"); };
    audio.oncanplaythrough = syncSeekability;
    audio.onplay = () => { setIsPlaying(true); setStatus("playing"); };
    audio.onpause = () => { setIsPlaying(false); setStatus("paused"); };
    audio.onended = () => { 
      setIsPlaying(false); 
      setCurrentTime(0); 
      setStatus("paused");
      if (isAudiobookModeRef.current) {
        goToNextPage(); 
      }
    };
    audio.onerror = () => setStatus("error");

    audio.play().catch(() => { setIsPlaying(false); setStatus("paused"); });
  }, [playbackRate, goToNextPage]);

  const generate = useCallback(async () => {
    if (isGeneratingRef.current) return;
    
    const cacheKey = `${currentPage.id}:${lang}`;
    const myId = ++requestIdRef.current;

    if (cacheRef.current.has(cacheKey)) {
      mountAudio(cacheRef.current.get(cacheKey)!);
      return;
    }

    isGeneratingRef.current = true;
    setStatus("loading");
    if (myId !== requestIdRef.current) {
      isGeneratingRef.current = false;
      return;
    }

    const params = new URLSearchParams({ pageId: currentPage.id, languageCode: lang, voice: "alloy", tone: "narrator" });
    const apiUrl = `/api/audio/stream?${params.toString()}`;

    try {
      const res = await fetch(apiUrl);
      if (myId !== requestIdRef.current) {
        isGeneratingRef.current = false;
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error === "AUDIO_LIMIT_REACHED" || err.error === "daily_limit_reached") {
          setStatus("no_credits");
          onLimitReached();
        } else if (err.error === "upgrade_required") {
          setStatus("upgrade_required");
        } else if (err.error === "TRANSLATION_REQUIRED") {
          setStatus("translation_required");
        } else {
          setStatus("error");
        }
        isGeneratingRef.current = false;
        return;
      }

      const blob = await res.blob();
      if (myId !== requestIdRef.current) {
        URL.revokeObjectURL(blobUrlRef.current || "");
        isGeneratingRef.current = false;
        return;
      }
      
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;
      cacheRef.current.set(cacheKey, blobUrl);

      mountAudio(blobUrl);
      isGeneratingRef.current = false;
    } catch (err) {
      if (myId === requestIdRef.current) setStatus("error");
      isGeneratingRef.current = false;
    }
  }, [currentPage.id, lang, mountAudio, onLimitReached]);

  const prefetchAudio = useCallback(async (pageId: string, langCode: string) => {
    const cacheKey = `${pageId}:${langCode}`;
    if (cacheRef.current.has(cacheKey)) return;

    const params = new URLSearchParams({ pageId, languageCode: langCode, voice: "alloy", tone: "narrator" });
    const apiUrl = `/api/audio/stream?${params.toString()}`;

    try {
      const res = await fetch(apiUrl);
      if (!res.ok) return;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      cacheRef.current.set(cacheKey, blobUrl);
    } catch (err) {
      // silently fail prefetch
    }
  }, []);

  useEffect(() => {
    if (isAudiobookMode && status === "idle") {
      generate();
    }
  }, [isAudiobookMode, status, generate]);

  useEffect(() => {
    if (isAudiobookMode && status === "translation_required" && txStatus === "idle") {
      generate();
    }
  }, [isAudiobookMode, txStatus, status, generate]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(() => setStatus("error"));
  }, [isPlaying]);

  const seek = useCallback((secs: number) => {
    if (!audioRef.current) return;
    const maxTime = duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
    audioRef.current.currentTime = Math.max(0, Math.min(secs, maxTime));
  }, [duration]);

  const seekByPct = useCallback((pct: number) => {
    if (!audioRef.current || !duration) return;
    audioRef.current.currentTime = (pct / 100) * duration;
  }, [duration]);

  const changeRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return { status, isPlaying, currentTime, duration, progress, playbackRate, canUseAdvancedControls, generate, togglePlayPause, seek, seekByPct, changeRate, prefetchAudio };
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function NavigationSidebar({ book, theme, totalPages, currentPageNum, progress, goToPage, toc, isAudiobookMode }: { book: Book; theme: Theme; totalPages: number; currentPageNum: number; progress: number; goToPage: (n: number) => void; toc: ChapterTOC[]; isAudiobookMode: boolean; }) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const sidebarChapters = toc.length > 0 ? toc : [{ chapter_number: 0, chapter_title: "Pages", first_page: 1, last_page: totalPages }];
  useEffect(() => { activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [currentPageNum]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="reader-themed-control" style={{ color: theme.muted }}><Menu className="w-5 h-5" /></Button>
      </SheetTrigger>
      <SheetContent side="left" className="reader-sheet-content w-70 p-0" style={{ backgroundColor: theme.bg, borderColor: theme.border, "--reader-control-hover": `${theme.accent}18`, "--reader-control-active": `${theme.accent}24`, "--reader-control-border": theme.border, "--reader-control-text": theme.muted, "--reader-control-text-hover": theme.accent } as React.CSSProperties}>
        <SheetHeader className="p-4 border-b" style={{ borderColor: theme.border }}>
          <SheetTitle className="text-sm flex items-center gap-2 text-left" style={{ color: theme.text }}>
            <BookOpen className="w-4 h-4 shrink-0" style={{ color: theme.accent }} />
            <span className="truncate">{book.title}</span>
          </SheetTitle>
          {book.author && <p className="text-xs" style={{ color: theme.muted, fontFamily: "Georgia, serif" }}>{book.author}</p>}
          <div className="mt-2">
            <div className="flex justify-between text-[10px] mb-1" style={{ color: theme.muted }}><span>Progress</span><span>{Math.round(progress)}%</span></div>
            <div className="h-1 rounded-full" style={{ backgroundColor: theme.border }}>
              <div className="h-1 rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: theme.accent }} />
            </div>
          </div>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-130px)]">
          <div className="p-2">
            {sidebarChapters.map((chapter) => (
              <div key={`${chapter.chapter_number}-${chapter.first_page}`} className="mb-4">
                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: theme.text, opacity: 0.8 }}>{chapter.chapter_title}</p>
                {Array.from({ length: chapter.last_page - chapter.first_page + 1 }, (_, i) => chapter.first_page + i).map((num) => {
                  const active = num === currentPageNum;
                  return (
                    <button 
                      key={num} 
                      ref={active ? activeRef : undefined} 
                      onClick={() => goToPage(num)} 
                      disabled={isAudiobookMode} 
                      className="reader-themed-control w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mb-px disabled:opacity-30 disabled:cursor-not-allowed" 
                      style={{ backgroundColor: active ? `${theme.accent}18` : "transparent", color: active ? theme.accent : theme.muted, fontWeight: active ? 600 : 400 }}
                    >
                      Page {num}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function SettingsPanel({ theme, prefs, updatePref, prefetchEnabled, onPrefetchToggle, isFreeUser }: { theme: Theme; prefs: Prefs; updatePref: <K extends keyof Prefs>(key: K, val: Prefs[K]) => void; prefetchEnabled: boolean; onPrefetchToggle: (e: boolean) => void; isFreeUser: boolean; }) {
  const fontSizeIdx = FONT_SIZES.indexOf(prefs.fontSize);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="reader-themed-control h-8 w-8" style={{ color: theme.muted }}><Settings2 className="w-4 h-4" /></Button>
      </SheetTrigger>
      <SheetContent side="right" className="reader-sheet-content w-72 p-0" style={{ backgroundColor: theme.bg, borderColor: theme.border, "--reader-control-hover": `${theme.accent}18`, "--reader-control-active": `${theme.accent}24`, "--reader-control-border": theme.border, "--reader-control-text": theme.muted, "--reader-control-text-hover": theme.accent } as React.CSSProperties}>
        <SheetHeader className="p-5 border-b" style={{ borderColor: theme.border }}>
          <SheetTitle className="text-sm flex items-center gap-2" style={{ color: theme.text }}><Settings2 className="w-4 h-4" style={{ color: theme.accent }} />Reading Settings</SheetTitle>
        </SheetHeader>
        <div className="p-5 space-y-6">
          <div>
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: theme.muted }}>Font Size</p>
            <div className="flex items-center gap-4">
              <button onClick={() => fontSizeIdx > 0 && updatePref("fontSize", FONT_SIZES[fontSizeIdx - 1])} disabled={fontSizeIdx === 0} className="reader-themed-control w-8 h-8 rounded-lg border flex items-center justify-center disabled:opacity-30" style={{ borderColor: theme.border, color: theme.text }}><Minus className="w-3 h-3" /></button>
              <span className="flex-1 text-center text-sm font-medium" style={{ color: theme.text }}>{prefs.fontSize}px</span>
              <button onClick={() => fontSizeIdx < FONT_SIZES.length - 1 && updatePref("fontSize", FONT_SIZES[fontSizeIdx + 1])} disabled={fontSizeIdx === FONT_SIZES.length - 1} className="reader-themed-control w-8 h-8 rounded-lg border flex items-center justify-center disabled:opacity-30" style={{ borderColor: theme.border, color: theme.text }}><Plus className="w-3 h-3" /></button>
            </div>
          </div>
          <Separator style={{ backgroundColor: theme.border }} />
          <div>
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: theme.muted }}>Line Spacing</p>
            <div className="flex gap-2">
              {LINE_HEIGHTS.map((lh, i) => {
                const active = prefs.lineHeight === lh;
                return <button key={lh} onClick={() => updatePref("lineHeight", lh)} className="flex-1 py-1.5 rounded-lg border text-xs transition-colors" style={{ borderColor: active ? theme.accent : theme.border, color: active ? theme.accent : theme.muted, backgroundColor: active ? `${theme.accent}15` : "transparent" }}>{["XS", "S", "M", "L", "XL"][i]}</button>;
              })}
            </div>
          </div>
          <Separator style={{ backgroundColor: theme.border }} />
          <div>
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-1" style={{ color: theme.muted }}>Reading Width</p>
            <p className="text-[10px] mb-3" style={{ color: theme.muted, opacity: 0.6 }}>Max characters per line</p>
            <div className="flex gap-2">
              {Object.keys(LINE_WIDTHS).map((key, i) => {
                const active = prefs.lineWidth === key;
                return <button key={key} onClick={() => updatePref("lineWidth", key)} className="flex-1 py-1.5 rounded-lg border text-xs transition-colors" style={{ borderColor: active ? theme.accent : theme.border, color: active ? theme.accent : theme.muted, backgroundColor: active ? `${theme.accent}15` : "transparent" }}>{["S", "M", "L", "XL"][i]}</button>;
              })}
            </div>
          </div>
          <Separator style={{ backgroundColor: theme.border }} />
          <div>
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: theme.muted }}>Theme</p>
            <div className="grid grid-cols-5 gap-3">
              {THEMES.map((t) => {
                const active = prefs.themeId === t.id;
                return (
                  <button key={t.id} onClick={() => updatePref("themeId", t.id)} className="flex flex-col items-center gap-1.5">
                    <div className="w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all" style={{ backgroundColor: t.bg, borderColor: active ? t.accent : t.border, boxShadow: active ? `0 0 0 3px ${t.accent}30` : "none" }}>
                      <div className="space-y-1"><div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: t.text }} /><div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: t.muted }} /></div>
                    </div>
                    <span className="text-[10px]" style={{ color: active ? theme.accent : theme.muted }}>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <Separator style={{ backgroundColor: theme.border }} />
          <div>
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: theme.muted }}>Keyboard</p>
            <div className="space-y-2">
              {[["← / h", "Previous page"], ["→ / l", "Next page"]].map(([k, d]) => (
                <div key={k} className="flex items-center justify-between">
                  <code className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: theme.card, color: theme.muted }}>{k}</code>
                  <span className="text-xs" style={{ color: theme.muted }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
          <Separator style={{ backgroundColor: theme.border }} />
          <div>
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: theme.muted }}>Performance</p>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: theme.text }}>
                  Smart Prefetch
                  {isFreeUser && <Lock className="w-3 h-3" style={{ color: theme.muted }} />}
                </p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: theme.muted }}>Pre-translates the next page while you read. Required for Audiobook mode.</p>
              </div>
              <Switch checked={prefetchEnabled} onCheckedChange={onPrefetchToggle} className="shrink-0 mt-0.5" />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TranslationStatusBadge({ txStatus, lang, theme }: { txStatus: TxStatus; lang: string; theme: Theme; }) {
  const isVisible = lang !== "none" && txStatus !== "idle" && txStatus !== "prefetching";
  const activeLang = LANGUAGES.find((l) => l.code === lang);
  if (!isVisible) return <div className="flex h-4 md:h-5 mb-3 md:mb-4" aria-live="polite" aria-atomic="true" />;
  return (
    <div className="flex h-4 md:h-5 items-center gap-2 mb-3 md:mb-4" aria-live="polite" aria-atomic="true">
      {txStatus === "waiting" && <span className="flex items-center gap-1.5 text-xs" style={{ color: theme.muted }}><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: theme.muted }} />Reading...</span>}
      {txStatus === "translating" && <span className="flex items-center gap-1.5 text-xs" style={{ color: theme.muted }}><Sparkles className="w-3 h-3 animate-spin" style={{ color: theme.accent }} />Translating to {activeLang?.label}...</span>}
      {txStatus === "rate_limited" && <span className="flex items-center gap-1.5 text-xs" style={{ color: theme.muted }}><Clock className="w-3 h-3" />Translation paused — resuming shortly</span>}
      {txStatus === "error" && <span className="text-xs text-red-400">Translation unavailable — showing original</span>}
    </div>
  );
}

function DesktopSummaryPanel({ theme, summaryText, summaryStatus, isOpen, onClose, lang, summaryLabel }: { theme: Theme; summaryText: string | null; summaryStatus: SummaryStatus; isOpen: boolean; onClose: () => void; lang: string; summaryLabel: string; }) {
  const activeLang = LANGUAGES.find((l) => l.code === lang);
  const langLabel = lang === "none" ? "Original language" : activeLang?.label;
  return (
    <div className="fixed top-18 right-4 bottom-4 w-[320px] lg:w-105 z-40 rounded-2xl overflow-hidden group" style={{ transform: isOpen ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)", opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none", transition: "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)", backgroundColor: theme.card, border: `1px solid ${theme.border}`, boxShadow: "0 32px 64px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.04)", backdropFilter: "blur(20px)" }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${theme.border}` }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${theme.accent}20` }}><Wand2 className="w-3.5 h-3.5" style={{ color: theme.accent }} /></div>
          <div>
            <p className="text-xs font-semibold leading-tight" style={{ color: theme.text }}>{summaryLabel}</p>
            {lang !== "none" && <p className="text-[10px] leading-tight mt-px" style={{ color: theme.muted }}>{langLabel}</p>}
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95" style={{ backgroundColor: `${theme.muted}18`, color: theme.muted }} title="Close summary"><X className="w-3.5 h-3.5" /></button>
      </div>
      <ScrollArea className="h-[calc(100%-60px)]">
        <div className="px-5 py-5">
          {summaryStatus === "loading" && !summaryText && (
            <div className="space-y-3">
              {SUMMARY_SKELETON_WIDTHS.map((w, i) => <Skeleton key={i} className="h-3.5 rounded-md" style={{ width: w, backgroundColor: `${theme.muted}20` }} />)}
              <p className="text-[11px] mt-4" style={{ color: theme.muted }}>Summarizing {summaryLabel.toLowerCase()}...</p>
            </div>
          )}
          {summaryStatus === "loading" && summaryText && <SummaryBody text={summaryText} theme={theme} />}
          {summaryStatus === "error" && (
            <div className="flex flex-col items-center text-center gap-3 py-8">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${theme.accent}15` }}><Wand2 className="w-5 h-5" style={{ color: theme.accent }} /></div>
              <p className="text-sm font-medium" style={{ color: theme.text }}>Couldn&apos;t generate summary</p>
              <p className="text-xs leading-relaxed" style={{ color: theme.muted }}>Check your daily limit or try again.</p>
            </div>
          )}
          {summaryStatus === "idle" && summaryText && <SummaryBody text={summaryText} theme={theme} />}
        </div>
      </ScrollArea>
    </div>
  );
}

function MobileSummaryPanel({ theme, summaryText, summaryStatus, isOpen, onClose, lang, summaryLabel }: { theme: Theme; summaryText: string | null; summaryStatus: SummaryStatus; isOpen: boolean; onClose: () => void; lang: string; summaryLabel: string; }) {
  const activeLang = LANGUAGES.find((l) => l.code === lang);
  const langLabel = lang === "none" ? "Original" : activeLang?.label;
  return (
    <div className="grid transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr", marginTop: isOpen ? "2rem" : "0" }}>
      <div className="overflow-hidden">
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: theme.card, borderColor: theme.border, boxShadow: "0 8px 24px -4px rgba(0,0,0,0.12)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: theme.border }}>
            <div className="flex items-center gap-2"><Wand2 className="w-4 h-4" style={{ color: theme.accent }} /><span className="text-xs font-semibold" style={{ color: theme.text }}>{summaryLabel} {lang !== "none" && `· ${langLabel}`}</span></div>
            <button onClick={onClose} className="w-6 h-6 rounded-md flex items-center justify-center transition-colors" style={{ backgroundColor: `${theme.muted}15`, color: theme.muted }}><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="px-4 py-4">
            {summaryStatus === "loading" && !summaryText && <div className="space-y-2.5">{SUMMARY_SKELETON_WIDTHS.map((w, i) => <Skeleton key={i} className="h-3.5 rounded" style={{ width: w, backgroundColor: `${theme.muted}20` }} />)}</div>}
            {summaryStatus === "loading" && summaryText && <SummaryBody text={summaryText} theme={theme} />}
            {summaryStatus === "error" && <p className="text-xs text-red-400">Failed to generate summary.</p>}
            {summaryStatus === "idle" && summaryText && <SummaryBody text={summaryText} theme={theme} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function LimitDialog({ open, onClose, feature, updatePref, isPro }: { open: boolean; onClose: () => void; feature: "translation" | "summary" | "audio"; updatePref: <K extends keyof Prefs>(key: K, val: Prefs[K]) => void; isPro: boolean; }) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Daily limit reached</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ve reached your daily {feature} limit. Your limit resets at midnight UTC.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {feature === "translation" ? (
            <AlertDialogCancel onClick={() => { updatePref("lang", "none"); onClose(); }}>Read original</AlertDialogCancel>
          ) : (
            <AlertDialogCancel onClick={onClose}>Close</AlertDialogCancel>
          )}
          {!isPro && (
            <AlertDialogAction onClick={() => (window.location.href = "/billing")}>
              Upgrade to Pro
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AudioController({ theme, isOpen, onClose, book, currentPage, lang, status, isPlaying, currentTime, duration, progress, playbackRate, canUseAdvancedControls, onGenerate, onTogglePlay, onSeek, onSeekByPct, onChangeRate, isAudiobookMode, onToggleAudiobook }: any) {
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const activeLang = LANGUAGES.find((l) => l.code === lang);
  const langLabel = lang === "none" ? "Original" : activeLang?.label;
  const hasControls = status === "playing" || status === "paused";
  const canSeekForward = canUseAdvancedControls && Number.isFinite(duration) && duration > 0;

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40" onClick={onClose} />}
      <div className="fixed bottom-6 left-1/2 z-50" style={{ width: "min(90vw, 480px)", transform: isOpen ? "translateX(-50%) translateY(0) scale(1)" : "translateX(-50%) translateY(calc(100% + 24px)) scale(0.96)", opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none", transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease" }}>
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, boxShadow: "0 24px 48px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)", backdropFilter: "blur(24px)" }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
            <div className="w-10 h-10 rounded-lg shrink-0 overflow-hidden flex items-center justify-center" style={{ backgroundColor: `${theme.accent}20` }}>
              {book.cover_url ? <Image src={book.cover_url} alt="" className="w-full h-full object-cover" height={100} width={100} crossOrigin="anonymous" /> : <BookOpen className="w-5 h-5" style={{ color: theme.accent }} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate leading-tight" style={{ color: theme.text, fontFamily: "Georgia, serif" }}>{book.title}</p>
              <p className="text-[11px] mt-0.5" style={{ color: theme.muted }}>Page {currentPage.page_number} · {langLabel}</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0" style={{ backgroundColor: `${theme.muted}15`, color: theme.muted }}><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="px-4 py-4">
            {status === "idle" && (
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${theme.accent}15` }}><Headphones className="w-6 h-6" style={{ color: theme.accent }} /></div>
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: theme.text }}>Listen to this page</p>
                  <p className="text-[11px] mt-0.5" style={{ color: theme.muted }}>AI voice · {langLabel}</p>
                </div>
                <button onClick={onGenerate} className="px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-transform hover:scale-105 active:scale-95" style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)` }}>Generate Audio</button>
              </div>
            )}
            {status === "loading" && (
              <div className="flex flex-col items-center gap-4 py-3">
                <div className="flex items-end gap-1 h-10">
                  {[3, 5, 8, 6, 9, 4, 7, 5, 8, 3, 6, 4, 9, 7, 5].map((h, i) => (
                    <div key={i} className="w-1 rounded-full" style={{ height: `${h * 10}%`, backgroundColor: theme.accent, opacity: 0.4 + (h / 9) * 0.6, animation: `audioWave 1.2s ease-in-out infinite`, animationDelay: `${i * 0.08}s` }} />
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: theme.text }}>Generating audio</p>
                  <p className="text-[11px] mt-0.5" style={{ color: theme.muted }}>{langLabel} voice · this takes a few seconds</p>
                </div>
              </div>
            )}
            {status === "error" && (
              <div className="flex items-center justify-between py-2">
                <div><p className="text-sm font-medium text-red-400">Generation failed</p><p className="text-[11px] mt-0.5" style={{ color: theme.muted }}>Something went wrong. Try again.</p></div>
                <button onClick={onGenerate} className="px-4 py-2 rounded-full text-xs font-semibold border transition-colors" style={{ borderColor: theme.border, color: theme.accent }}>Retry</button>
              </div>
            )}
            {status === "upgrade_required" && (
              <div className="flex items-center justify-between py-2">
                <div><p className="text-sm font-medium" style={{ color: theme.text }}>Plus feature</p><p className="text-[11px] mt-0.5" style={{ color: theme.muted }}>Upgrade to listen to books</p></div>
                <button onClick={() => (window.location.href = "/billing")} className="px-4 py-2 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: theme.accent }}>Upgrade</button>
              </div>
            )}
            {status === "no_credits" && (
              <div className="text-center py-2">
                <p className="text-sm font-medium" style={{ color: theme.text }}>Daily audio limit reached</p>
                <p className="text-[11px] mt-0.5" style={{ color: theme.muted }}>Resets at midnight UTC</p>
              </div>
            )}
            {status === "translation_required" && (
              <div className="flex items-center justify-between py-2 gap-4">
                <div><p className="text-sm font-medium" style={{ color: theme.text }}>Translate first</p><p className="text-[11px] mt-0.5" style={{ color: theme.muted }}>Audio uses the saved translated page.</p></div>
                <button onClick={onGenerate} className="px-4 py-2 rounded-full text-xs font-semibold border transition-colors" style={{ borderColor: theme.border, color: theme.accent }}>Retry</button>
              </div>
            )}
            {hasControls && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => onSeek(currentTime - 10)} className="flex flex-col items-center gap-0.5 group" title="−10 seconds">
                    <RotateCcw className="w-5 h-5 transition-transform group-hover:scale-110" style={{ color: theme.muted }} />
                    <span className="text-[9px] font-bold" style={{ color: theme.muted }}>10</span>
                  </button>
                  <button onClick={() => onSeek(0)} className="transition-transform hover:scale-110"><SkipBack className="w-5 h-5" style={{ color: theme.muted }} /></button>
                  <button onClick={onTogglePlay} className="w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-lg" style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}bb)` }}>
                    {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-0.5" />}
                  </button>
                  <button onClick={() => onSeek(duration)} disabled={!canSeekForward} className="transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-35"><SkipForward className="w-5 h-5" style={{ color: theme.muted }} /></button>
                  <button onClick={() => onSeek(currentTime + 10)} disabled={!canSeekForward} className="flex flex-col items-center gap-0.5 group disabled:cursor-not-allowed disabled:opacity-35" title="+10 seconds">
                    <RotateCw className="w-5 h-5 transition-transform group-hover:scale-110" style={{ color: theme.muted }} />
                    <span className="text-[9px] font-bold" style={{ color: theme.muted }}>10</span>
                  </button>
                </div>
                <div className="space-y-1.5">
                  <div className="relative h-1.5 rounded-full cursor-pointer group" style={{ backgroundColor: `${theme.muted}25` }}>
                    <input type="range" min={0} max={100} step={0.1} value={progress} onChange={(e) => onSeekByPct(Number(e.target.value))} disabled={!canSeekForward} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                    <div className="h-full rounded-full transition-all duration-100" style={{ width: `${progress}%`, backgroundColor: theme.accent }} />
                    <div className="absolute top-1/2 w-3.5 h-3.5 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${progress}%`, transform: "translate(-50%, -50%)", backgroundColor: "#fff", border: `2px solid ${theme.accent}` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] tabular-nums" style={{ color: theme.muted }}>{fmt(currentTime)}</span>
                    <div className="flex items-center gap-0.5">
                      {[0.75, 1, 1.25, 1.5].map((rate) => (
                        <button key={rate} onClick={() => onChangeRate(rate)} disabled={!canSeekForward} className="px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35" style={{ backgroundColor: playbackRate === rate ? `${theme.accent}20` : "transparent", color: playbackRate === rate ? theme.accent : theme.muted }}>{rate}×</button>
                      ))}
                    </div>
                    <span className="text-[10px] tabular-nums" style={{ color: theme.muted }}>{fmt(duration)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Audiobook Mode Toggle */}
          <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: theme.border }}>
            <div>
              <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: theme.text }}>
                Audiobook Mode
              </p>
              <p className="text-[11px]" style={{ color: theme.muted }}>Auto-play next page</p>
            </div>
            <Switch checked={isAudiobookMode} onCheckedChange={onToggleAudiobook} />
          </div>
        </div>
      </div>
      <style>{`@keyframes audioWave { 0%, 100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }`}</style>
    </>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export function ReaderClient({
  book, initialPage, totalPages, initialPrefetchEnabled, toc, isAuthenticated = true, userPlan = "free"
}: {
  book: Book; initialPage: Page; totalPages: number; initialPrefetchEnabled: boolean; toc: ChapterTOC[]; isAuthenticated?: boolean; userPlan?: string;
}) {
  const { prefs, updatePref } = useReaderPrefs();
  const theme = THEMES.find((t) => t.id === prefs.themeId) ?? THEMES[0];
  const router = useRouter();

  const [prefetchEnabled, setPrefetchEnabled] = useState(initialPrefetchEnabled);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [isAudioOpen, setIsAudioOpen] = useState(false);
  const [limitError, setLimitError] = useState<null | "translation" | "summary" | "audio">(null);
  const [isAudiobookMode, setIsAudiobookMode] = useState(false);
  const [prefetchPromptOpen, setPrefetchPromptOpen] = useState(false);
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false); // New state for upgrade dialog
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const mobileSummaryRef = useRef<HTMLDivElement | null>(null);
  const scrollHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isReaderScrolling, setIsReaderScrolling] = useState(false);
  const [scrollThumb, setScrollThumb] = useState({ top: 0, height: 0 });

  const requireAuth = useCallback(() => setAuthPromptOpen(true), []);
  const handleLimitReached = useCallback((feature: "translation" | "summary" | "audio") => setLimitError(feature), []);
  
  const handleTranslationLimit = useCallback(() => handleLimitReached("translation"), [handleLimitReached]);
  const handleSummaryLimit = useCallback(() => handleLimitReached("summary"), [handleLimitReached]);
  const handleAudioLimit = useCallback(() => handleLimitReached("audio"), [handleLimitReached]);

  const handlePrefetchToggle = useCallback((enabled: boolean) => {
    if (!isAuthenticated) return requireAuth();
    // Restrict free users from enabling prefetch
    if (enabled && userPlan === "free") {
      setUpgradePromptOpen(true);
      return;
    }
    setPrefetchEnabled(enabled); 
    togglePrefetch(enabled);
  }, [isAuthenticated, requireAuth, userPlan]);

  const { currentPage, isNavigating, goToPage, manualGoToPage, pageCache, currentPageRef, fetchPage } = usePageNavigation(book, initialPage, totalPages, isAuthenticated, isAudiobookMode);
  const isPdfImage = currentPage.render_type === "pdf_image";
  const readerToc = useMemo(() => (isPdfImage ? [] : toc), [isPdfImage, toc]);
  const summaryLabel = isPdfImage ? "Page Summary" : "Chapter Summary";

  const goNextPage = useCallback(() => goToPage(currentPageRef.current.page_number + 1), [goToPage, currentPageRef]);

  const audioEngine = useAudioEngine(
    currentPage, 
    isAuthenticated ? prefs.lang : "none", 
    txStatus,
    handleAudioLimit,
    isAudiobookMode,
    goNextPage
  );

  const handlePrefetchSuccess = useCallback((pageId: string) => {
    if (isAudiobookMode) {
      audioEngine.prefetchAudio(pageId, isAuthenticated ? prefs.lang : "none");
    }
  }, [isAudiobookMode, prefs.lang, isAuthenticated, audioEngine.prefetchAudio]);

  const { displayContent } = useTranslationEngine(
    currentPage, isAuthenticated ? prefs.lang : "none", book, totalPages, pageCache, currentPageRef, isAuthenticated ? prefetchEnabled : false,
    handleTranslationLimit,
    handlePrefetchSuccess,
    setTxStatus
  );

  const { summaryText, summaryStatus, fetchSummary, clearSummary } = useSummaryEngine(book, readerToc, handleSummaryLimit);

  useEffect(() => { setIsSummaryOpen(false); clearSummary(); }, [currentPage.id, clearSummary]);
  useEffect(() => { scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [currentPage.page_number]);

  const handleReaderScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      const ratio = el.clientHeight / Math.max(el.scrollHeight, 1);
      setScrollThumb({ top: (el.scrollTop / Math.max(el.scrollHeight, 1)) * 100, height: Math.max(10, ratio * 100) });
    }
    setIsReaderScrolling(true);
    if (scrollHideTimerRef.current) clearTimeout(scrollHideTimerRef.current);
    scrollHideTimerRef.current = setTimeout(() => setIsReaderScrolling(false), 900);
  }, []);

  useEffect(() => { return () => { if (scrollHideTimerRef.current) clearTimeout(scrollHideTimerRef.current); }; }, []);

  const handleSummarize = useCallback(() => {
    if (!isAuthenticated) return requireAuth();
    setIsSummaryOpen(true);
    fetchSummary(currentPage, prefs.lang);
    window.setTimeout(() => {
      if (!window.matchMedia("(max-width: 1023px)").matches) return;
      mobileSummaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }, [currentPage, prefs.lang, fetchSummary, isAuthenticated, requireAuth]);

  const handleSummaryClose = useCallback(() => { setIsSummaryOpen(false); clearSummary(); }, [clearSummary]);

  const handleToggleAudiobook = useCallback((val: boolean) => {
    if (!isAuthenticated) return requireAuth();
    // Restrict free users from enabling audiobook mode
    if (val && userPlan === "free") {
      setUpgradePromptOpen(true);
      return;
    }
    if (val && !prefetchEnabled) {
      setPrefetchPromptOpen(true);
      return;
    }
    setIsAudiobookMode(val);
  }, [prefetchEnabled, userPlan, isAuthenticated, requireAuth]);

  const progress = (currentPage.page_number / totalPages) * 100;

  const prepareBookContent = (rawText: string): string => {
    if (!rawText) return "";
    let processed = rawText;
    processed = processed.replace(/\b1ve\b/gi, "five");
    processed = processed.replace(/^([A-Z0-9])\s*$/gm, "");
    if (processed.includes("Table of Contents")) processed = processed.replace(/•\s*(Chapter\s+\d+)/g, "\n* $1");
    processed = processed.replace(/(#{1,6}\s+)/g, "\n\n$1");
    processed = processed.replace(/^(Chapter\s+\d+|Table of Contents)$/gim, "\n\n## $1\n\n");
    processed = processed.replace(/^(#{1,6}\s+)(.{120,})$/gm, "$2");
    processed = processed.replace(/\n{3,}/g, "\n\n");
    return processed.trim();
  };

  const isEpubXhtml = currentPage.render_type === "epub_xhtml";
  const formattedContent = isEpubXhtml ? displayContent : prepareBookContent(displayContent);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: theme.bg, color: theme.text, "--reader-scrollbar-thumb": theme.accent, "--reader-scrollbar-track": theme.border, "--reader-control-hover": `${theme.accent}18`, "--reader-control-active": `${theme.accent}24`, "--reader-control-border": theme.border, "--reader-control-text": theme.muted, "--reader-control-text-hover": theme.accent, "--reader-panel-bg": theme.bg, "--reader-panel-card": theme.card, transition: "background-color 0.3s, color 0.3s" } as React.CSSProperties}>
      <header className="shrink-0 flex items-center gap-2 px-4 h-14 border-b z-50" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
        <Button variant="outline" size="icon" className="reader-themed-control cursor-pointer" onClick={() => router.back()} style={{ color: theme.muted, borderColor: theme.border, backgroundColor: "transparent" }}><ChevronLeft /></Button>
        <NavigationSidebar 
          book={book} 
          theme={theme} 
          totalPages={totalPages} 
          currentPageNum={currentPage.page_number} 
          progress={progress} 
          goToPage={manualGoToPage} 
          toc={readerToc} 
          isAudiobookMode={isAudiobookMode} 
        />
        <h1 className="flex-1 text-sm font-semibold truncate text-center" style={{ color: theme.text, fontFamily: "Georgia, serif" }}>{book.title}</h1>
        <div className="flex items-center gap-1">
          <Select 
            value={isAuthenticated ? prefs.lang : "none"} 
            onValueChange={(v) => { if (!isAuthenticated && v !== "none") return requireAuth(); updatePref("lang", v); }} 
            disabled={isAudiobookMode || txStatus === "translating"}
          >
            <SelectTrigger className="reader-themed-control border" style={{ color: theme.muted, backgroundColor: "transparent", borderColor: theme.border }}><SelectValue /></SelectTrigger>
            <SelectContent className="reader-select-content p-2" style={{ backgroundColor: theme.card, borderColor: theme.border, color: theme.text, "--reader-control-hover": `${theme.accent}18`, "--reader-control-text-hover": theme.accent } as React.CSSProperties}>
              {LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="reader-themed-control h-8 w-8 ml-1 transition-all duration-200" onClick={handleSummarize} data-active={isSummaryOpen ? "true" : undefined} style={{ color: isSummaryOpen ? theme.accent : theme.muted, backgroundColor: isSummaryOpen ? `${theme.accent}15` : "transparent" }} title={`Summarize this ${isPdfImage ? "page" : "chapter"}`}><Wand2 className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="reader-themed-control h-8 w-8 transition-all duration-200" onClick={() => { if (!isAuthenticated) return requireAuth(); setIsAudioOpen((v) => !v); }} data-active={isAudioOpen ? "true" : undefined} style={{ color: isAudioOpen ? theme.accent : theme.muted, backgroundColor: isAudioOpen ? `${theme.accent}15` : "transparent" }} title="Listen to this page"><Headphones className="w-4 h-4" /></Button>
          <SettingsPanel theme={theme} prefs={prefs} updatePref={updatePref} prefetchEnabled={prefetchEnabled} onPrefetchToggle={handlePrefetchToggle} isFreeUser={userPlan === "free"} />
        </div>
      </header>

      <div className="shrink-0 h-px w-full" style={{ backgroundColor: theme.border }}>
        <div className="h-px transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: theme.accent }} />
      </div>

      <main ref={scrollContainerRef} onScroll={handleReaderScroll} className="reader-scroll flex-1 overflow-y-auto">
        <div className="px-6 pt-12 pb-8 md:pt-20 mx-auto w-full" style={{ maxWidth: currentPage.render_type === "pdf_image" ? "min(100%, 64rem)" : (LINE_WIDTHS[prefs.lineWidth] ?? "48rem") }}>
          <TranslationStatusBadge txStatus={txStatus} lang={prefs.lang} theme={theme} />
          <div className="relative min-h-[20rem]">
            <article 
              className={`transition-opacity duration-300 ${txStatus === "translating" || isNavigating ? "opacity-0" : "opacity-100"} ${isSummaryOpen && summaryStatus === "loading" ? "animate-pulse" : ""}`}
              style={{ fontSize: `${prefs.fontSize}px`, lineHeight: prefs.lineHeight, color: theme.text, fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: "0.01em" }}
            >
              {isEpubXhtml ? (
                <EpubXhtmlRenderer html={formattedContent} theme={theme} fontSize={prefs.fontSize} lineHeight={prefs.lineHeight} onNavigateToPage={manualGoToPage} />
              ) : (
                <ReactMarkdown components={{ h1: ({ children }) => <h1 style={{ fontSize: `${prefs.fontSize * 1.4}px`, fontFamily: "Georgia, serif", fontWeight: "bold" }} className="my-6 block text-balance">{children}</h1>, h2: ({ children }) => <h2 style={{ fontSize: `${prefs.fontSize * 1.25}px`, fontFamily: "Georgia, serif", fontWeight: "semibold" }} className="my-4 block">{children}</h2>, p: ({ children }) => <p style={{ lineHeight: prefs.lineHeight }} className="mb-4 block">{children}</p>, li: ({ children }) => <li className="ml-4 list-disc list-inside mb-1">{children}</li>, ul: ({ children }) => <ul className="my-4 block">{children}</ul>, img: ({ src, alt, title }) => <MarkdownImage src={typeof src === "string" ? src : undefined} alt={alt} title={title} eager={isPdfImage} className={isPdfImage ? "max-h-none shadow-sm" : "max-h-[70vh]"} /> }}>
                  {formattedContent}
                </ReactMarkdown>
              )}
            </article>
            {txStatus === "translating" && <TranslationShimmer theme={theme} />}
          </div>
          <div ref={mobileSummaryRef} className="lg:hidden scroll-mt-6">
            <MobileSummaryPanel theme={theme} summaryText={summaryText} summaryStatus={summaryStatus} isOpen={isSummaryOpen} onClose={handleSummaryClose} lang={prefs.lang} summaryLabel={summaryLabel} />
          </div>
        </div>
      </main>

      <div className="pointer-events-none fixed right-1 top-16 bottom-18 z-40 w-1.5" aria-hidden="true">
        <div className="absolute left-0 right-0 rounded-full transition-opacity duration-200" style={{ top: `${scrollThumb.top}%`, height: `${scrollThumb.height}%`, maxHeight: "100%", opacity: isReaderScrolling && scrollThumb.height < 98 ? 1 : 0, backgroundColor: theme.accent }} />
      </div>

      <footer className="shrink-0 h-16 flex items-center justify-between px-6 border-t" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
        {!isAudiobookMode ? (
          <>
            <Button variant="ghost" disabled={currentPage.page_number <= 1 || isNavigating} onClick={() => manualGoToPage(currentPage.page_number - 1)} className="reader-themed-control gap-2 rounded-xl" style={{ color: theme.muted }}>
              <ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline text-sm">Previous</span>
            </Button>
            <span className="text-xs font-medium tabular-nums" style={{ color: theme.muted }}>{currentPage.page_number} / {totalPages}</span>
            <Button variant="ghost" disabled={currentPage.page_number >= totalPages || isNavigating} onClick={() => manualGoToPage(currentPage.page_number + 1)} className="reader-themed-control gap-2 rounded-xl" style={{ color: theme.muted }}>
              <span className="hidden sm:inline text-sm">Next</span><ChevronRight className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <div className="w-full flex items-center justify-center gap-2 text-xs" style={{ color: theme.muted }}>
            <Headphones className="w-3.5 h-3.5" />
            <span>Audiobook mode active — Turn off to navigate pages manually</span>
          </div>
        )}
      </footer>

      <div className="hidden lg:block">
        <DesktopSummaryPanel theme={theme} summaryText={summaryText} summaryStatus={summaryStatus} isOpen={isSummaryOpen} onClose={handleSummaryClose} lang={prefs.lang} summaryLabel={summaryLabel} />
      </div>

      <AudioController
        theme={theme}
        isOpen={isAudioOpen}
        onClose={() => setIsAudioOpen(false)}
        book={book}
        currentPage={currentPage}
        lang={prefs.lang}
        status={audioEngine.status}
        isPlaying={audioEngine.isPlaying}
        currentTime={audioEngine.currentTime}
        duration={audioEngine.duration}
        progress={audioEngine.progress}
        playbackRate={audioEngine.playbackRate}
        canUseAdvancedControls={audioEngine.canUseAdvancedControls}
        onGenerate={audioEngine.generate}
        onTogglePlay={audioEngine.togglePlayPause}
        onSeek={audioEngine.seek}
        onSeekByPct={audioEngine.seekByPct}
        onChangeRate={audioEngine.changeRate}
        isAudiobookMode={isAudiobookMode}
        onToggleAudiobook={handleToggleAudiobook}
      />

      <AlertDialog open={authPromptOpen} onOpenChange={setAuthPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log in to use reader tools</AlertDialogTitle>
            <AlertDialogDescription>Public books are free to read. Translation, summaries, audio, saved progress, favorites, and reading lists require a Glintpage account.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep reading</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push("/auth/login")}>Log in</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={prefetchPromptOpen} onOpenChange={setPrefetchPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable Smart Prefetch?</AlertDialogTitle>
            <AlertDialogDescription>
              Audiobook mode requires Smart Prefetch to be enabled so it can read the next page&apos;s text in advance. Do you want to enable it now?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { 
              setPrefetchEnabled(true); 
              togglePrefetch(true); 
              setIsAudiobookMode(true); 
              setPrefetchPromptOpen(false); 
            }}>
              Enable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={upgradePromptOpen} onOpenChange={setUpgradePromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Plus Feature</AlertDialogTitle>
            <AlertDialogDescription>
              Smart Prefetch and Audiobook Mode are premium features available on Plus and Pro plans. Upgrade your account to unlock seamless listening.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Maybe later</AlertDialogCancel>
            <AlertDialogAction onClick={() => (window.location.href = "/billing")}>
              Upgrade to Pro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LimitDialog 
        open={!!limitError} 
        onClose={() => setLimitError(null)} 
        feature={limitError || "translation"} 
        updatePref={updatePref} 
        isPro={userPlan !== 'free'} 
      />

      <style jsx global>{`
        .reader-themed-control { border-color: var(--reader-control-border) !important; color: var(--reader-control-text) !important; transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease; }
        .reader-themed-control:hover:not(:disabled) { background-color: var(--reader-control-hover) !important; border-color: var(--reader-control-text-hover) !important; color: var(--reader-control-text-hover) !important; }
        .reader-themed-control:active:not(:disabled) { background-color: var(--reader-control-active) !important; transform: scale(0.98); }
        .reader-themed-control[data-state="open"] { background-color: var(--reader-control-active) !important; color: var(--reader-control-text-hover) !important; }
        .reader-themed-control[data-active="true"] { background-color: var(--reader-control-active) !important; color: var(--reader-control-text-hover) !important; border-color: var(--reader-control-text-hover) !important; }
        .reader-sheet-content > button { background-color: var(--reader-control-hover) !important; color: var(--reader-control-text) !important; border: 1px solid var(--reader-control-border) !important; border-radius: 0.75rem; top: 0.875rem; right: 0.875rem; }
        .reader-sheet-content > button:hover { background-color: var(--reader-control-active) !important; color: var(--reader-control-text-hover) !important; }
        .reader-select-content [data-highlighted] { background-color: var(--reader-control-hover) !important; color: var(--reader-control-text-hover) !important; }
        .summary-stream-paragraph { animation: summaryParagraphIn 420ms ease both; }
        @keyframes summaryParagraphIn { from { opacity: 0; transform: translateY(6px); filter: blur(2px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
        .reader-translation-shimmer { position: relative; overflow: hidden; background: linear-gradient(90deg, color-mix(in srgb, var(--shimmer-muted), transparent 82%), color-mix(in srgb, var(--shimmer-accent), transparent 62%), color-mix(in srgb, var(--shimmer-muted), transparent 86%)); box-shadow: 0 0 18px color-mix(in srgb, var(--shimmer-accent), transparent 76%), inset 0 0 12px color-mix(in srgb, var(--shimmer-accent), transparent 84%); animation: readerLinePulse 1.45s ease-in-out infinite; }
        .reader-translation-shimmer::after { content: ""; position: absolute; inset: 0; transform: translateX(-120%); background: linear-gradient(90deg, transparent, color-mix(in srgb, white, var(--shimmer-accent) 35%), transparent); opacity: 0.55; animation: readerLineShine 1.65s ease-in-out infinite; }
        @keyframes readerLinePulse { 0%, 100% { opacity: 0.24; transform: scaleX(0.985); } 50% { opacity: 0.78; transform: scaleX(1); } }
        @keyframes readerLineShine { to { transform: translateX(130%); } }
        .reader-scroll { scrollbar-color: transparent transparent; scrollbar-width: none; }
        .reader-scroll::-webkit-scrollbar { height: 0; width: 0; }
        .reader-scroll::-webkit-scrollbar-track { background: transparent; }
        .reader-scroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--reader-scrollbar-thumb), transparent 35%); border-radius: 999px; }
        .reader-scroll::-webkit-scrollbar-thumb:hover { background: var(--reader-scrollbar-thumb); }
        .epub-renderer { color: var(--epub-text); font-size: var(--epub-font-size); line-height: var(--epub-line-height); font-family: Georgia, "Times New Roman", serif; overflow-wrap: break-word; }
        .epub-renderer * { max-width: 100%; }
        .epub-renderer p { margin: 0 0 1em; }
        .epub-renderer img, .epub-renderer svg { display: block; height: auto; max-height: 75vh; max-width: 100%; margin: 1.25rem auto; object-fit: contain; }
        .epub-renderer a { color: var(--epub-link); }
        .epub-renderer table { border-collapse: inherit; border-spacing: inherit; margin: 1rem 0; max-width: 100%; }
        .epub-renderer th, .epub-renderer td { vertical-align: top; }
        .epub-renderer td p, .epub-renderer th p { margin: 0; }
      `}</style>
    </div>
  );
}