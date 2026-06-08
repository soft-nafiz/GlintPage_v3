"use server";

import { createClient } from "../supabase/server";
import OpenAI from "openai";

// ─── Groq ─────────────────────────────────────────────────────────────────────

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getReadablePageContent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  pageId: string,
): Promise<{ content: string } | { error: string }> {
  const { data: page, error: pageError } = await supabase
    .from("book_pages")
    .select("id, book_id, content")
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

  return { content: page.content };
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
      return { translation: cached.translated_content };
    }
  }

  console.log("[translate] cache MISS — checking daily quota");

  // 2. Quota check + atomic increment (only on cache miss)
  const { data: quota, error: rpcError } = await supabase.rpc(
    "check_and_increment_usage",
    { u_id: user.id, action: "translation" },
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
    `[translate] quota OK — ${quota.remaining} pages remaining today`,
  );

  // 3. Call AI
  const { text: translatedText, rateLimited } = await callAi(
    buildTranslationPrompt(readablePage.content, languageCode, previousContext),
  );

  if (rateLimited || !translatedText) {
    await supabase.rpc("reverse_quota_deduction", {
      u_id: user.id,
      action: "translation",
    });
    return {
      error: rateLimited
        ? "RATE_LIMITED"
        : "Generation failure. Quota refunded.",
    };
  }
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

  // 2. Quota check
  const { data: quota, error: rpcError } = await supabase.rpc(
    "check_and_increment_usage",
    { u_id: user.id, action: "summary" },
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
    `[summary] quota OK — ${quota.remaining} summaries remaining today`,
  );

  // 3. Call AI
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
    await supabase.rpc("reverse_quota_deduction", {
      u_id: user.id,
      action: "summary",
    });
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
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("reading_progress").upsert(
    {
      user_id: user.id,
      book_id: bookId,
      current_chunk_index: chunkIndex,
      progress_percentage: percentage,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,book_id" },
  );

  if (error) {
    console.error("[progress] save error:", error.message);
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
