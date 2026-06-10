"use server";

import { createClient } from "../supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import OpenAI from "openai";

// ─── Groq ─────────────────────────────────────────────────────────────────────

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TRANSLATION_AVERAGE_PAGE_CHARS = 2250;
const TRANSLATION_AVERAGE_PAGE_TOKENS = 900;
const MIN_TRANSLATION_QUOTA_TOKENS = 50;
const MIN_SUMMARY_QUOTA_TOKENS = 100;
const SUMMARY_SINGLE_PAGE_BATCH_OVERHEAD = 250;

function countReadableChars(parts: Array<string | null | undefined>) {
  return parts.reduce((total, part) => total + String(part || "").trim().length, 0);
}

function estimateTranslationQuotaTokens(
  ...parts: Array<string | null | undefined>
) {
  const chars = countReadableChars(parts);
  if (chars <= 0) return 0;
  return Math.max(
    MIN_TRANSLATION_QUOTA_TOKENS,
    Math.ceil(
      (chars * TRANSLATION_AVERAGE_PAGE_TOKENS) /
        TRANSLATION_AVERAGE_PAGE_CHARS,
    ),
  );
}

function estimateSummaryQuotaTokens(text: string) {
  const chars = countReadableChars([text]);
  if (chars <= 0) return 0;
  return Math.max(
    MIN_SUMMARY_QUOTA_TOKENS,
    Math.ceil(chars / 4) + SUMMARY_SINGLE_PAGE_BATCH_OVERHEAD,
  );
}

async function getReadablePageContent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  pageId: string,
): Promise<
  | {
      content: string;
      renderType?: string | null;
      renderContent?: string | null;
      aiText?: string | null;
    }
  | { error: string }
> {
  const { data: page, error: pageError } = await supabase
    .from("book_pages")
    .select("id, book_id, content, render_type, render_content, ai_text")
    .eq("id", pageId)
    .maybeSingle();

  if (pageError) {
    console.error("[reader-ai] page lookup error:", pageError.message);
    return { error: "Unable to load page." };
  }

  if (!page) return { error: "Page not found." };

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id")
    .eq("id", page.book_id)
    .eq("status", "completed")
    .or(`user_id.eq.${userId},is_public.eq.true`)
    .maybeSingle();

  if (bookError) {
    console.error("[reader-ai] book access lookup error:", bookError.message);
    return { error: "Unable to verify book access." };
  }

  if (!book) return { error: "Book not found." };

  return {
    content:
      page.render_type === "epub_xhtml"
        ? getPlainTextFromAiText(page.ai_text) || page.content
        : page.content,
    renderType: page.render_type,
    renderContent: page.render_content,
    aiText: page.ai_text,
  };
}

async function callAi(
  prompt: string,
  attempt = 0,
): Promise<{ text: string | null; rateLimited: boolean }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices?.[0]?.message?.content?.trim() ?? null;
    return { text, rateLimited: false };
  } catch (err: unknown) {
    const error = err as {
      status?: number;
      headers?: Record<string, string>;
      message?: string;
    };
    // OpenAI SDK throws errors instead of returning response objects
    if (error.status === 429) {
      if (attempt < 2) {
        const retryAfter = parseInt(error.headers?.["retry-after"] ?? "5");
        const delay = Math.min(retryAfter * 1000, 10_000);
        console.warn(
          `[translate] 429 — retrying in ${delay}ms (attempt ${attempt + 1})`,
        );
        await new Promise((r) => setTimeout(r, delay));
        return callAi(prompt, attempt + 1);
      }
      return { text: null, rateLimited: true };
    }

    console.error("[translate] OpenAI error:", error.message);
    return { text: null, rateLimited: false };
  }
}

function buildTranslationPrompt(
  text: string,
  language: string,
  previousContext?: string,
): string {
  return `You are a master literary translator with 20 years of experience translating English non-fiction into publication-ready ${language} prose.

  ${previousContext ? `CONTEXT FROM PREVIOUS PAGES:\n${previousContext}\n` : ""}

TASK:
Translate the following English book page excerpt into fluent, elegant ${language}.

TRANSLATION PHILOSOPHY:
- Do not improve, simplify, reinterpret, or modernize the author's ideas, preserve meaning with maximum fidelity while adapting language naturally in ${language}.
- A native reader should feel this was written in ${language} originally — not translated from English.
- Preserve the author's rhetorical devices: repetition, irony, build-up, and payoff lines.

LANGUAGE RULES:
- Use [Specify Register/Dialect, e.g., Modern conversational literary prose / Standard contemporary dialect].
- Avoid overly archaic, hyper-formal, or outdated linguistic structures unless the tone explicitly demands gravitas.
- When English idioms have no direct equivalent, find a culturally resonant idiom in ${language} that carries the same emotional and rhetorical weight. Do not force a literal translation.
- Maintain sentence rhythm. If the English uses short, punchy sentences for impact (e.g., "Click, whirr!"), mirror that pacing in ${language}.
- Retain specialized technical terms, proper nouns, and book-specific motifs with consistent transliteration or accepted regional nomenclature across all pages.
- Preserve every Markdown structural marker exactly when it appears on its own line, especially image placeholders like [[GLINTPAGE_IMAGE_0]]. Do not translate, remove, reorder, or wrap those placeholders.
- Preserve Markdown paragraph breaks. Do not convert Markdown image placeholders into prose.

PROCESS (internal — do not output):
1. Read the full passage and identify: tone, rhetorical structure, cultural references, and idioms.
2. Draft a first translation.
3. Read it aloud mentally in the target language. Does it flow? Does it sound natural?
4. Revise any stiff, rigid, or overly literal-sounding phrases.
5. Final check: verify all original meaning is preserved, ensuring nothing is arbitrarily added or omitted.

OUTPUT:
Only the final ${language} translation. No explanations, no alternatives, no commentary. Exactly as it would appear in a published book.

TEXT:
${text}`;
}

type EpubTextNode = { id: string; text: string };

function getPlainTextFromAiText(aiText?: string | null): string {
  const nodes = parseEpubTextNodes(aiText);
  return nodes.map((node) => node.text).join("\n\n").trim();
}

function parseEpubTextNodes(aiText?: string | null): EpubTextNode[] {
  try {
    const parsed = JSON.parse(aiText || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((node) => ({
        id: String(node.id || ""),
        text: String(node.text || "").trim(),
      }))
      .filter((node) => node.id && node.text);
  } catch {
    return [];
  }
}

function buildEpubTranslationPrompt(
  nodes: EpubTextNode[],
  language: string,
  previousContext?: string,
): string {
  return `You are a master literary translator translating an EPUB while preserving its original layout.

${previousContext ? `CONTEXT FROM PREVIOUS PAGES:\n${previousContext}\n` : ""}

TASK:
Translate each JSON item's "text" into fluent, publication-ready ${language}.

RULES:
- Return ONLY valid JSON.
- Return a JSON array with the exact same item count and exact same "id" values.
- Translate only the "text" values.
- Do not add explanations, Markdown, code fences, comments, or extra keys.
- Preserve names, tone, rhythm, and literary style.
- The translated text will replace text nodes inside the original EPUB layout, so keep each item suitable for the same local context.

INPUT JSON:
${JSON.stringify(nodes)}`;
}

function parseAiJsonArray(text: string): EpubTextNode[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("AI did not return a JSON array");
  return parsed.map((node) => ({
    id: String(node.id || ""),
    text: String(node.text || ""),
  }));
}

function injectTranslatedEpubTextNodes(
  html: string,
  originalNodes: EpubTextNode[],
  translatedNodes: EpubTextNode[],
) {
  const byId = new Map(
    translatedNodes
      .filter((node) => node.id)
      .map((node) => [node.id, node.text] as const),
  );

  let translatedHtml = html;

  for (const node of originalNodes) {
    if (!byId.has(node.id)) continue;
    const escapedId = escapeRegExp(node.id);
    const replacement = escapeHtml(byId.get(node.id) || "");
    translatedHtml = translatedHtml.replace(
      new RegExp(
        `(<span\\b[^>]*data-gp-text-id=["']${escapedId}["'][^>]*>)([\\s\\S]*?)(<\\/span>)`,
        "g",
      ),
      `$1${replacement}$3`,
    );
  }

  return translatedHtml;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function protectMarkdownImages(markdown: string): {
  text: string;
  images: Array<{ marker: string; markdown: string }>;
} {
  const images: Array<{ marker: string; markdown: string }> = [];
  const text = markdown.replace(
    /(^|\n)(!\[[^\]\n]*]\([^) \n]+(?:\s+"[^"\n]*")?\))(?=\n|$)/g,
    (match, prefix: string, imageMarkdown: string) => {
      const marker = `[[GLINTPAGE_IMAGE_${images.length}]]`;
      images.push({ marker, markdown: imageMarkdown });
      return `${prefix}${marker}`;
    },
  );

  return { text, images };
}

function getMarkdownImageUrl(imageMarkdown: string): string | null {
  return (
    imageMarkdown.match(/!\[[^\]\n]*]\(([^) \n]+)(?:\s+"[^"\n]*")?\)/)?.[1] ??
    null
  );
}

function collectMarkdownImages(markdown: string): Array<{
  markdown: string;
  url: string | null;
}> {
  return Array.from(
    markdown.matchAll(
      /(^|\n)(!\[[^\]\n]*]\([^) \n]+(?:\s+"[^"\n]*")?\))(?=\n|$)/g,
    ),
    (match) => ({
      markdown: match[2],
      url: getMarkdownImageUrl(match[2]),
    }),
  );
}

function ensureMarkdownImagesPresent(
  translatedText: string,
  originalText: string,
) {
  const missingImages = collectMarkdownImages(originalText)
    .filter((image) => {
      if (translatedText.includes(image.markdown)) return false;
      if (image.url && translatedText.includes(image.url)) return false;
      return true;
    })
    .map((image) => image.markdown);

  if (missingImages.length === 0) return translatedText;

  return `${missingImages.join("\n\n")}\n\n${translatedText}`
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function restoreMarkdownImages(
  translatedText: string,
  images: Array<{ marker: string; markdown: string }>,
): string {
  let restored = translatedText;
  const missingImages: string[] = [];

  for (const image of images) {
    if (restored.includes(image.marker)) {
      restored = restored.split(image.marker).join(image.markdown);
    } else {
      missingImages.push(image.markdown);
    }
  }

  if (missingImages.length > 0) {
    restored = `${missingImages.join("\n\n")}\n\n${restored}`;
  }

  return restored.replace(/\n{3,}/g, "\n\n").trim();
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function translatePage(
  pageId: string,
  languageCode: string,
  _originalText?: string,
  forceRefresh?: boolean,
  previousContext?: string,
): Promise<{ translation?: string; error?: string }> {
  void _originalText;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const readablePage = await getReadablePageContent(supabase, user.id, pageId);
  if ("error" in readablePage) return { error: readablePage.error };

  console.log(
    `[translate] user=${user.id} page=${pageId} lang=${languageCode}`,
  );

  // 1. Global cache check — free, never counts against quota
  if (!forceRefresh) {
    const { data: cached, error: cacheError } = await supabase
      .from("translations")
      .select("translated_content")
      .eq("page_id", pageId)
      .eq("language_code", languageCode)
      .maybeSingle();

    if (cacheError) {
      console.error("[translate] cache lookup error:", cacheError.message);
    }

    if (cached?.translated_content) {
      console.log("[translate] cache HIT — free return");
      if (readablePage.renderType === "epub_xhtml") {
        return { translation: cached.translated_content };
      }

      const repairedTranslation = ensureMarkdownImagesPresent(
        cached.translated_content,
        readablePage.content,
      );

      if (repairedTranslation !== cached.translated_content) {
        const { error: repairError } = await supabase
          .from("translations")
          .update({ translated_content: repairedTranslation })
          .eq("page_id", pageId)
          .eq("language_code", languageCode);

        if (repairError) {
          console.error(
            "[translate] cache image repair failed:",
            repairError.message,
          );
        }
      }

      return { translation: repairedTranslation };
    }
  }

  console.log("[translate] cache MISS — checking daily quota");

  const isEpubLayout =
    readablePage.renderType === "epub_xhtml" &&
    Boolean(readablePage.renderContent) &&
    Boolean(readablePage.aiText);
  const originalNodes = isEpubLayout
    ? parseEpubTextNodes(readablePage.aiText)
    : [];
  const protectedContent = isEpubLayout
    ? null
    : protectMarkdownImages(readablePage.content);
  const sourceForQuota = isEpubLayout
    ? originalNodes.map((node) => node.text).join("\n\n")
    : protectedContent?.text || "";
  const requestedTokens = estimateTranslationQuotaTokens(
    sourceForQuota,
    previousContext,
  );

  if (isEpubLayout && originalNodes.length === 0) {
    return { error: "No translatable EPUB text found." };
  }

  if (requestedTokens <= 0) {
    return { error: "No readable text found." };
  }

  let chargedTokens = 0;
  const refundTranslationQuota = async () => {
    if (chargedTokens <= 0) return;
    await supabase.rpc("reverse_quota_deduction", {
      u_id: user.id,
      action: "translation",
      charged_tokens: chargedTokens,
    });
  };

  console.log(
    `[translate] checking daily token quota - requested=${requestedTokens}`,
  );

  // 2. Quota check + atomic token increment (only on cache miss)
  const { data: quota, error: rpcError } = await supabase.rpc(
    "check_and_increment_usage",
    { u_id: user.id, action: "translation", requested_tokens: requestedTokens },
  );

  if (rpcError) {
    console.error("[translate] quota RPC error:", rpcError.message);
    return { error: "Failed to check quota. Please try again." };
  }

  // quota is the jsonb response — check allowed flag
  if (!quota?.allowed) {
    console.log("[translate] quota denied:", quota);
    if (quota?.reason === "daily_limit_reached") {
      return { error: "DAILY_LIMIT_REACHED" };
    }
    if (quota?.reason === "user_not_found") {
      return { error: "Account not found. Please sign in again." };
    }
    return { error: "Translation not available on your current plan." };
  }

  console.log(
    `[translate] quota OK — ${quota.remaining} tokens remaining today`,
  );

  chargedTokens = Number(quota.charged_tokens || 0);

  // 3. Call AI
  if (isEpubLayout && readablePage.renderContent) {
    const { text: rawEpubTranslation, rateLimited: epubRateLimited } =
      await callAi(
        buildEpubTranslationPrompt(
          originalNodes,
          languageCode,
          previousContext,
        ),
      );

    if (epubRateLimited || !rawEpubTranslation) {
      await refundTranslationQuota();
      return {
        error: epubRateLimited
          ? "RATE_LIMITED"
          : "Generation failure. Quota refunded.",
      };
    }

    let translatedText: string;
    try {
      const translatedNodes = parseAiJsonArray(rawEpubTranslation);
      translatedText = injectTranslatedEpubTextNodes(
        readablePage.renderContent,
        originalNodes,
        translatedNodes,
      );
    } catch (err) {
      await refundTranslationQuota();
      console.error("[translate] EPUB JSON parse error:", err);
      return { error: "Translation format failed. Quota refunded." };
    }

    const { error: insertError } = await supabase.from("translations").upsert(
      {
        page_id: pageId,
        language_code: languageCode,
        translated_content: translatedText,
        user_id: forceRefresh ? user.id : null,
      },
      { onConflict: "page_id,language_code,user_id" },
    );

    if (insertError) {
      console.error("[translate] cache insert failed:", insertError.message);
    } else {
      console.log("[translate] cached globally");
    }

    return { translation: translatedText };
  }

  if (!protectedContent) {
    await refundTranslationQuota();
    return { error: "No readable text found. Quota refunded." };
  }

  const { text: rawTranslatedText, rateLimited } = await callAi(
    buildTranslationPrompt(protectedContent.text, languageCode, previousContext),
  );

  if (rateLimited || !rawTranslatedText) {
    await refundTranslationQuota();
    return {
      error: rateLimited
        ? "RATE_LIMITED"
        : "Generation failure. Quota refunded.",
    };
  }

  const translatedText = restoreMarkdownImages(
    rawTranslatedText,
    protectedContent.images,
  );
  // 4. Save to global cache (non-fatal if it fails)
  const { error: insertError } = await supabase.from("translations").upsert(
    {
      page_id: pageId,
      language_code: languageCode,
      translated_content: translatedText,
      user_id: forceRefresh ? user.id : null,
    },
    { onConflict: "page_id,language_code,user_id" },
  );

  if (insertError) {
    console.error("[translate] cache insert failed:", insertError.message);
  } else {
    console.log("[translate] cached globally");
  }

  // Note: usage_logs insert is handled inside check_and_increment_usage RPC
  // Do NOT insert again here — that was causing double logging

  return { translation: translatedText };
}

export async function summarizePage(
  pageId: string,
  languageCode: string, // "none" → summarize in book's original language
  _originalText?: string,
): Promise<{ summary?: string; error?: string }> {
  void _originalText;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const readablePage = await getReadablePageContent(supabase, user.id, pageId);
  if ("error" in readablePage) return { error: readablePage.error };

  const targetLang = languageCode === "none" ? "original" : languageCode;

  // 1. Global cache check — free, no quota
  const { data: cached } = await supabase
    .from("summaries")
    .select("summary_content")
    .eq("page_id", pageId)
    .eq("language_code", targetLang)
    .maybeSingle();

  if (cached?.summary_content) {
    console.log("[summary] cache HIT");
    return { summary: cached.summary_content };
  }

  const requestedTokens = estimateSummaryQuotaTokens(readablePage.content);
  if (requestedTokens <= 0) {
    return { error: "No readable text found." };
  }

  let chargedTokens = 0;
  const refundSummaryQuota = async () => {
    if (chargedTokens <= 0) return;
    await supabase.rpc("reverse_quota_deduction", {
      u_id: user.id,
      action: "summary",
      charged_tokens: chargedTokens,
    });
  };

  // 2. Quota check
  const { data: quota, error: rpcError } = await supabase.rpc(
    "check_and_increment_usage",
    { u_id: user.id, action: "summary", requested_tokens: requestedTokens },
  );

  if (rpcError) {
    console.error("[summary] quota RPC error:", rpcError.message);
    return { error: "Failed to check quota." };
  }

  if (!quota?.allowed) {
    if (quota?.reason === "daily_limit_reached")
      return { error: "DAILY_LIMIT_REACHED" };
    return { error: "UPGRADE_REQUIRED" };
  }

  console.log(
    `[summary] quota OK — ${quota.remaining} tokens remaining today`,
  );

  // 3. Call AI
  chargedTokens = Number(quota.charged_tokens || 0);

  const langInstruction =
    languageCode === "none"
      ? "in the same language as the original text"
      : `in ${languageCode}`;

  const prompt = `Summarize the following text ${langInstruction}.

Requirements:
- Write 3–5 concise sentences capturing only the key ideas and events
- Preserve important details, character names, and themes
- Use clear, readable language natural to the target language
- Do not add opinions, commentary, or external knowledge
- Output ONLY the summary, nothing else

Text:
${readablePage.content}`;

  const { text, rateLimited } = await callAi(prompt);

  if (rateLimited || !text) {
    await refundSummaryQuota();
    return {
      error: rateLimited
        ? "RATE_LIMITED"
        : "Summary failed. Quota refunded.",
    };
  }

  // 4. Cache globally
  const { error: insertError } = await supabase.from("summaries").insert({
    page_id: pageId,
    language_code: targetLang,
    summary_content: text,
  });
  if (insertError)
    console.error("[summary] cache insert failed:", insertError.message);

  return { summary: text };
}

export async function saveReadingProgress(
  bookId: string,
  chunkIndex: number,
  percentage: number,
  secondsDelta = 0,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const safeSecondsDelta = Math.max(0, Math.min(Math.round(secondsDelta || 0), 60));
  const { data: existing } = await supabase
    .from("reading_progress")
    .select("total_read_seconds")
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .maybeSingle();

  const { error } = await supabase.from("reading_progress").upsert(
    {
      user_id: user.id,
      book_id: bookId,
      current_chunk_index: chunkIndex,
      progress_percentage: percentage,
      total_read_seconds:
        Number(existing?.total_read_seconds || 0) + safeSecondsDelta,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,book_id" },
  );

  if (error) {
    console.error("[progress] save error:", error.message);
  }

  if (!error && safeSecondsDelta > 0) {
    const { data: book } = await supabaseAdmin
      .from("books")
      .select("is_public, total_read_seconds")
      .eq("id", bookId)
      .maybeSingle();

    if (book?.is_public) {
      await supabaseAdmin
        .from("books")
        .update({
          total_read_seconds:
            Number(book.total_read_seconds || 0) + safeSecondsDelta,
        })
        .eq("id", bookId);
    }
  }
}

export async function togglePrefetch(enabled: boolean) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("profiles")
    .update({ prefetch_enabled: enabled })
    .eq("id", user.id);

  if (error) {
    console.error("[prefetch] toggle error:", error.message);
  }
}
