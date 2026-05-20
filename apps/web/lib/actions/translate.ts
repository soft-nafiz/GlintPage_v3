"use server";

import { createClient } from "../supabase/server";

// ─── Groq ─────────────────────────────────────────────────────────────────────

async function callGroqWithRetry(
  prompt: string,
  attempt = 0,
): Promise<{ text: string | null; rateLimited: boolean }> {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 2048,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    },
  );

  if (response.status === 429) {
    if (attempt < 2) {
      const retryAfter = parseInt(response.headers.get("retry-after") ?? "5");
      const delay = Math.min(retryAfter * 1000, 10_000);
      console.warn(
        `[translate] 429 — retrying in ${delay}ms (attempt ${attempt + 1})`,
      );
      await new Promise((r) => setTimeout(r, delay));
      return callGroqWithRetry(prompt, attempt + 1);
    }
    return { text: null, rateLimited: true };
  }

  if (!response.ok) {
    console.error(
      `[translate] Groq error ${response.status}:`,
      await response.text(),
    );
    return { text: null, rateLimited: false };
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim() ?? null;
  return { text, rateLimited: false };
}

function buildTranslationPrompt(text: string, language: string): string {
  return `Translate the following text into ${language}.

Requirements:
- Preserve the original meaning, tone, and nuance exactly.
- Use natural, fluent, native-quality ${language} — not word-for-word literal translation.
- Adapt sentence structure to sound natural in ${language}.
- Maintain all paragraph breaks and formatting.
- Do not summarize, explain, add commentary, or omit anything.
- Output ONLY the translated text, nothing else.

Text:
${text}`;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function translatePage(
  pageId: string,
  languageCode: string,
  originalText: string,
): Promise<{ translation?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  console.log(
    `[translate] user=${user.id} page=${pageId} lang=${languageCode}`,
  );

  // 1. Global cache check — free, never counts against quota
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
  const { text: translatedText, rateLimited } = await callGroqWithRetry(
    buildTranslationPrompt(originalText, languageCode),
  );

  if (rateLimited) {
    return { error: "RATE_LIMITED" };
  }

  if (!translatedText) {
    return { error: "Translation returned empty. Please try again." };
  }

  // 4. Save to global cache (non-fatal if it fails)
  const { error: insertError } = await supabase.from("translations").insert({
    page_id: pageId,
    language_code: languageCode,
    translated_content: translatedText,
  });

  if (insertError) {
    console.error("[translate] cache insert failed:", insertError.message);
  } else {
    console.log("[translate] cached globally");
  }

  // Note: usage_logs insert is handled inside check_and_increment_usage RPC
  // Do NOT insert again here — that was causing double logging

  return { translation: translatedText };
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
