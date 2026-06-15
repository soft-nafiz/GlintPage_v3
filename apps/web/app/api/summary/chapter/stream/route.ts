import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const SUMMARY_BATCH_CHAR_TARGET = 12_000;
const SUMMARY_BATCH_OVERHEAD_TOKENS = 250;
const MIN_SUMMARY_QUOTA_TOKENS = 100;

type ChapterSummaryRequest = {
  bookId?: string;
  chapterNumber?: number;
  chapterTitle?: string;
  languageCode?: string;
  firstPage?: number;
  lastPage?: number;
  summaryScope?: "chapter" | "page";
};

type ChapterPage = {
  id: string;
  page_number: number;
  content: string;
  render_type?: string | null;
  ai_text?: string | null;
};

function encodeEvent(event: Record<string, unknown>) {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

function stripHtmlForSummary(text: string) {
  return String(text || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPlainTextFromAiText(aiText?: string | null) {
  try {
    const parsed = JSON.parse(aiText || "[]");
    if (!Array.isArray(parsed)) return "";
    return parsed
      .map((node) => String(node.text || ""))
      .join("\n\n")
      .trim();
  } catch {
    return "";
  }
}

function targetLanguage(languageCode: string) {
  return languageCode === "none"
    ? "the same language as the source text"
    : languageCode;
}

async function callAi(prompt: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices?.[0]?.message?.content?.trim() || "";
}

async function streamAi(prompt: string, onDelta: (delta: string) => void) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    stream: true,
    messages: [{ role: "user", content: prompt }],
  });

  let text = "";
  for await (const chunk of response) {
    const delta = chunk.choices?.[0]?.delta?.content || "";
    if (!delta) continue;
    text += delta;
    onDelta(delta);
  }

  return text.trim();
}

function batchPages(pages: Array<{ label: string; text: string }>) {
  const batches: Array<Array<{ label: string; text: string }>> = [];
  let current: Array<{ label: string; text: string }> = [];
  let currentLength = 0;

  for (const page of pages) {
    const length = page.text.length;
    if (current.length && currentLength + length > SUMMARY_BATCH_CHAR_TARGET) {
      batches.push(current);
      current = [];
      currentLength = 0;
    }
    current.push(page);
    currentLength += length;
  }

  if (current.length) batches.push(current);
  return batches;
}

function estimateSummaryQuotaTokens(
  pages: Array<{ label: string; text: string }>,
  batchCount: number,
) {
  const chars = pages.reduce(
    (total, page) => total + page.text.trim().length,
    0,
  );
  if (chars <= 0) return 0;
  return Math.max(
    MIN_SUMMARY_QUOTA_TOKENS,
    Math.ceil(chars / 4) +
      SUMMARY_BATCH_OVERHEAD_TOKENS * Math.max(batchCount, 1),
  );
}

function buildBatchPrompt({
  chapterTitle,
  languageCode,
  batch,
  summaryScope,
}: {
  chapterTitle: string;
  languageCode: string;
  batch: Array<{ label: string; text: string }>;
  summaryScope: "chapter" | "page";
}) {
  const sourceLabel = summaryScope === "page" ? "page" : "part of the chapter";
  return `Summarize this ${sourceLabel} "${chapterTitle}" in ${targetLanguage(languageCode)}.

Requirements:
- Capture the important ideas, events, claims, examples, and names.
- Keep continuity details useful for merging with other parts.
- Use clear, natural language in the requested language.
- Output only the partial summary.

Chapter pages:
${batch.map((page) => `\n[${page.label}]\n${page.text}`).join("\n")}`;
}

function buildMergePrompt({
  chapterTitle,
  languageCode,
  summaries,
}: {
  chapterTitle: string;
  languageCode: string;
  summaries: string[];
}) {
  return `Merge these partial summaries into one coherent chapter summary for "${chapterTitle}" in ${targetLanguage(languageCode)}.

Requirements:
- Write 5-9 concise sentences for a full chapter overview.
- Preserve the chapter's main argument, events, examples, names, and conclusions.
- Do not mention "partial summaries", batches, pages, or the process.
- Output only the final chapter summary.

Partial summaries:
${summaries.map((summary, index) => `\nPart ${index + 1}:\n${summary}`).join("\n")}`;
}

async function getReadableChapterPages({
  pages,
  languageCode,
  userId,
}: {
  pages: ChapterPage[];
  languageCode: string;
  userId: string;
}) {
  const pageIds = pages.map((page) => page.id);
  const translationsByPage = new Map<string, string>();

  if (languageCode !== "none" && pageIds.length) {
    const { data: userTranslations } = await supabaseAdmin
      .from("translations")
      .select("page_id, translated_content, created_at")
      .in("page_id", pageIds)
      .eq("language_code", languageCode)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    for (const translation of userTranslations || []) {
      if (!translationsByPage.has(translation.page_id)) {
        translationsByPage.set(
          translation.page_id,
          stripHtmlForSummary(translation.translated_content),
        );
      }
    }

    const missingIds = pageIds.filter((id) => !translationsByPage.has(id));
    if (missingIds.length) {
      const { data: globalTranslations } = await supabaseAdmin
        .from("translations")
        .select("page_id, translated_content, created_at")
        .in("page_id", missingIds)
        .eq("language_code", languageCode)
        .is("user_id", null)
        .order("created_at", { ascending: false });

      for (const translation of globalTranslations || []) {
        if (!translationsByPage.has(translation.page_id)) {
          translationsByPage.set(
            translation.page_id,
            stripHtmlForSummary(translation.translated_content),
          );
        }
      }
    }
  }

  return pages
    .map((page) => {
      const translated = translationsByPage.get(page.id);
      const source =
        translated ||
        (page.render_type === "epub_xhtml"
          ? getPlainTextFromAiText(page.ai_text) || page.content
          : page.content);
      return {
        label: `Page ${page.page_number}`,
        text: stripHtmlForSummary(source),
      };
    })
    .filter((page) => page.text);
}

export async function POST(req: NextRequest) {
  let body: ChapterSummaryRequest;
  try {
    body = (await req.json()) as ChapterSummaryRequest;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const bookId = body.bookId;
  const chapterNumber = Number(body.chapterNumber);
  const firstPage = Number(body.firstPage);
  const lastPage = Number(body.lastPage);
  const languageCode = body.languageCode || "none";
  const chapterTitle = body.chapterTitle || `Chapter ${chapterNumber}`;
  const summaryScope = body.summaryScope === "page" ? "page" : "chapter";

  if (
    !bookId ||
    !Number.isFinite(chapterNumber) ||
    !Number.isFinite(firstPage) ||
    !Number.isFinite(lastPage) ||
    firstPage < 1 ||
    lastPage < firstPage
  ) {
    return Response.json(
      { error: "Invalid chapter summary request" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: book } = await supabase
    .from("books")
    .select("id")
    .eq("id", bookId)
    .eq("status", "completed")
    .or(`user_id.eq.${user.id},is_public.eq.true`)
    .maybeSingle();

  if (!book) return Response.json({ error: "Book not found" }, { status: 404 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let chargedTokens = 0;
      const refundSummaryQuota = async () => {
        if (chargedTokens <= 0) return;
        await supabase.rpc("reverse_quota_deduction", {
          u_id: user.id,
          action: "summary",
          charged_tokens: chargedTokens,
        });
      };

      try {
        controller.enqueue(encodeEvent({ type: "status", status: "cache" }));

        const cacheLanguage =
          languageCode === "none" ? "original" : languageCode;
        const { data: cached } = await supabaseAdmin
          .from("chapter_summaries")
          .select("summary_content")
          .eq("book_id", bookId)
          .eq("chapter_number", chapterNumber)
          .eq("language_code", cacheLanguage)
          .eq("source_first_page", firstPage)
          .eq("source_last_page", lastPage)
          .maybeSingle();

        if (cached?.summary_content) {
          controller.enqueue(
            encodeEvent({ type: "final", summary: cached.summary_content }),
          );
          controller.close();
          return;
        }

        controller.enqueue(
          encodeEvent({ type: "status", status: "loading_chapter" }),
        );
        const { data: pages, error: pagesError } = await supabaseAdmin
          .from("book_pages")
          .select("id, page_number, content, render_type, ai_text")
          .eq("book_id", bookId)
          .gte("page_number", firstPage)
          .lte("page_number", lastPage)
          .order("page_number", { ascending: true });

        if (pagesError || !pages?.length) {
          await refundSummaryQuota();
          controller.enqueue(
            encodeEvent({
              type: "error",
              error: "Unable to load chapter pages",
            }),
          );
          controller.close();
          return;
        }

        const readablePages = await getReadableChapterPages({
          pages,
          languageCode,
          userId: user.id,
        });
        const batches = batchPages(readablePages);
        const requestedTokens = estimateSummaryQuotaTokens(
          readablePages,
          batches.length,
        );
        let finalSummary = "";

        if (!batches.length) {
          controller.enqueue(
            encodeEvent({
              type: "error",
              error: "No readable chapter text found",
            }),
          );
          controller.close();
          return;
        }

        controller.enqueue(encodeEvent({ type: "status", status: "quota" }));
        const { data: quota, error: rpcError } = await supabase.rpc(
          "check_and_increment_usage",
          {
            u_id: user.id,
            action: "summary",
            requested_tokens: requestedTokens,
          },
        );

        if (rpcError || !quota?.allowed) {
          controller.enqueue(
            encodeEvent({
              type: "error",
              error:
                quota?.reason === "daily_limit_reached"
                  ? "DAILY_LIMIT_REACHED"
                  : "UPGRADE_REQUIRED",
            }),
          );
          controller.close();
          return;
        }

        chargedTokens = Number(quota.charged_tokens || 0);

        if (batches.length === 1) {
          controller.enqueue(
            encodeEvent({
              type: "status",
              status: "summarizing",
              current: 1,
              total: batches.length,
            }),
          );
          finalSummary = await streamAi(
            buildBatchPrompt({
              chapterTitle,
              languageCode,
              batch: batches[0],
              summaryScope,
            }),
            (delta) =>
              controller.enqueue(encodeEvent({ type: "delta", delta })),
          );
        } else {
          const partialSummaries: string[] = [];

          for (let index = 0; index < batches.length; index += 1) {
            controller.enqueue(
              encodeEvent({
                type: "status",
                status: "summarizing",
                current: index + 1,
                total: batches.length,
              }),
            );
            partialSummaries.push(
              await callAi(
                buildBatchPrompt({
                  chapterTitle,
                  languageCode,
                  batch: batches[index],
                  summaryScope,
                }),
              ),
            );
          }

          controller.enqueue(
            encodeEvent({ type: "status", status: "merging" }),
          );
          finalSummary = await streamAi(
            buildMergePrompt({
              chapterTitle,
              languageCode,
              summaries: partialSummaries,
            }),
            (delta) =>
              controller.enqueue(encodeEvent({ type: "delta", delta })),
          );
        }

        if (!finalSummary) {
          await refundSummaryQuota();
          controller.enqueue(
            encodeEvent({ type: "error", error: "Summary failed" }),
          );
          controller.close();
          return;
        }

        const { error: cacheError } = await supabaseAdmin
          .from("chapter_summaries")
          .upsert(
            {
              book_id: bookId,
              chapter_number: chapterNumber,
              chapter_title: chapterTitle,
              language_code: cacheLanguage,
              source_first_page: firstPage,
              source_last_page: lastPage,
              summary_content: finalSummary,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict:
                "book_id,chapter_number,language_code,source_first_page,source_last_page",
            },
          );

        if (cacheError)
          console.error("[chapter-summary] cache failed:", cacheError.message);

        controller.enqueue(
          encodeEvent({ type: "final", summary: finalSummary }),
        );
        controller.close();
      } catch (error) {
        console.error("[chapter-summary] failed:", error);
        await refundSummaryQuota();
        controller.enqueue(
          encodeEvent({
            type: "error",
            error: error instanceof Error ? error.message : "Summary failed",
          }),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
