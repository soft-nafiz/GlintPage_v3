import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
] as const;
type Voice = (typeof VOICES)[number];

const TONE_INSTRUCTIONS: Record<string, string> = {
  narrator:
    "Narrate like a professional audiobook reader. Speak clearly, naturally, and at a comfortable pace. Use expressive intonation while remaining calm and easy to understand.",
  dramatic:
    "Read with theatrical drama and emotional depth. Emphasize important lines, pause for impact, and keep the delivery polished.",
  calm: "Read slowly and gently with a soothing, meditative pace. Keep the voice soft, steady, and easy to listen to.",
  academic:
    "Read in a precise, measured academic tone, like a thoughtful lecture that remains warm and approachable.",
  conversational:
    "Read naturally and conversationally, as if speaking to one engaged listener.",
};

type AudioRequest = {
  pageId?: string;
  languageCode?: string;
  voice?: string;
  tone?: string;
};

async function getReadablePage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  pageId: string,
): Promise<{ content: string } | { error: string; status: number }> {
  const { data: page, error: pageError } = await supabase
    .from("book_pages")
    .select("id, book_id, content, render_type, ai_text")
    .eq("id", pageId)
    .maybeSingle();

  if (pageError) {
    console.error("[audio] page lookup error:", pageError.message);
    return { error: "Unable to load page.", status: 500 };
  }

  if (!page) return { error: "Page not found.", status: 404 };

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id")
    .eq("id", page.book_id)
    .eq("status", "completed")
    .or(`user_id.eq.${userId},is_public.eq.true`)
    .maybeSingle();

  if (bookError) {
    console.error("[audio] book access lookup error:", bookError.message);
    return { error: "Unable to verify book access.", status: 500 };
  }

  if (!book) return { error: "Book not found.", status: 404 };

  return {
    content:
      page.render_type === "epub_xhtml"
        ? getPlainTextFromAiText(page.ai_text) || page.content
        : page.content,
  };
}

async function getAudioText(
  pageId: string,
  languageCode: string,
  userId: string,
  originalContent: string,
): Promise<{ text: string } | { error: string; status: number }> {
  if (languageCode === "none") return { text: originalContent };

  const { data: userTranslation } = await supabaseAdmin
    .from("translations")
    .select("translated_content")
    .eq("page_id", pageId)
    .eq("language_code", languageCode)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (userTranslation?.translated_content) {
    return { text: stripHtmlForAudio(userTranslation.translated_content) };
  }

  const { data: globalTranslation } = await supabaseAdmin
    .from("translations")
    .select("translated_content")
    .eq("page_id", pageId)
    .eq("language_code", languageCode)
    .is("user_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (globalTranslation?.translated_content) {
    return { text: stripHtmlForAudio(globalTranslation.translated_content) };
  }

  return {
    error: "TRANSLATION_REQUIRED",
    status: 409,
  };
}

function getPlainTextFromAiText(aiText: string | null | undefined): string {
  try {
    const nodes = JSON.parse(aiText || "[]");
    if (!Array.isArray(nodes)) return "";
    return nodes.map((node) => String(node.text || "")).join("\n\n").trim();
  } catch {
    return "";
  }
}

function stripHtmlForAudio(text: string): string {
  return text
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVoice(voice: string | undefined): Voice {
  return VOICES.includes(voice as Voice) ? (voice as Voice) : "alloy";
}

function estimateMinutes(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(wordCount / 150, 0.1);
}

function streamAndCacheAudio(
  source: ReadableStream<Uint8Array>,
  {
    pageId,
    languageCode,
    voice,
    tone,
    estimatedMinutes,
  }: {
    pageId: string;
    languageCode: string;
    voice: Voice;
    tone: string;
    estimatedMinutes: number;
  },
) {
  const fileName = `audio/${pageId}_${languageCode}_${voice}_${tone}.mp3`;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = source.getReader();
      const chunks: Uint8Array[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;

          const chunk = new Uint8Array(value);
          chunks.push(chunk);
          controller.enqueue(chunk);
        }

        controller.close();

        const audioBuffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
        const { error: uploadError } = await supabaseAdmin.storage
          .from("library")
          .upload(fileName, audioBuffer, {
            contentType: "audio/mpeg",
            upsert: true,
          });

        if (uploadError) {
          console.error("[audio] cache upload failed:", uploadError.message);
          return;
        }

        const { data: urlData } = supabaseAdmin.storage
          .from("library")
          .getPublicUrl(fileName);

        const { error: cacheError } = await supabaseAdmin
          .from("audio_pages")
          .insert({
            page_id: pageId,
            language_code: languageCode,
            voice,
            tone,
            audio_url: urlData.publicUrl,
            duration_secs: Math.round(estimatedMinutes * 60),
          });

        if (cacheError) {
          console.error("[audio] DB cache upsert failed:", cacheError.message);
        }
      } catch (error) {
        console.error("[audio] stream/cache failed:", error);
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
    cancel() {
      source.cancel().catch(() => {});
    },
  });
}

async function handleAudioStream(body: AudioRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const pageId = body.pageId;
  const languageCode = body.languageCode ?? "none";
  const voice = normalizeVoice(body.voice);
  const tone = body.tone || "narrator";

  if (!pageId) {
    return NextResponse.json({ error: "Missing pageId" }, { status: 400 });
  }

  const readablePage = await getReadablePage(supabase, user.id, pageId);
  if ("error" in readablePage) {
    return NextResponse.json(
      { error: readablePage.error },
      { status: readablePage.status },
    );
  }

  const textResult = await getAudioText(
    pageId,
    languageCode,
    user.id,
    readablePage.content,
  );
  if ("error" in textResult) {
    return NextResponse.json(
      { error: textResult.error },
      { status: textResult.status },
    );
  }

  const { data: cached } = await supabaseAdmin
    .from("audio_pages")
    .select("audio_url")
    .eq("page_id", pageId)
    .eq("language_code", languageCode)
    .eq("voice", voice)
    .eq("tone", tone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached?.audio_url) {
    return NextResponse.redirect(cached.audio_url, { status: 302 });
  }

  const estimatedMinutes = estimateMinutes(textResult.text);
  const { data: quota, error: rpcError } = await supabase.rpc(
    "check_and_increment_audio",
    { u_id: user.id, estimated_minutes: estimatedMinutes },
  );

  if (rpcError) {
    console.error("[audio] quota RPC error:", rpcError.message);
    return NextResponse.json(
      { error: "Failed to check audio quota." },
      { status: 500 },
    );
  }

  if (!quota?.allowed) {
    return NextResponse.json(
      { error: quota?.reason || "AUDIO_LIMIT_REACHED" },
      { status: 403 },
    );
  }

  let speech: Awaited<ReturnType<typeof openai.audio.speech.create>>;
  try {
    speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: textResult.text,
      response_format: "mp3",
      instructions: TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.narrator,
    });
  } catch (error) {
    console.error("[audio] TTS generation failed:", error);
    await supabase.rpc("reverse_audio_deduction", {
      u_id: user.id,
      minutes_to_refund: estimatedMinutes,
    });
    return NextResponse.json(
      { error: "Audio generation failed. Quota refunded." },
      { status: 502 },
    );
  }

  const stream = speech.body;
  if (!stream) {
    return NextResponse.json(
      { error: "Audio stream unavailable." },
      { status: 502 },
    );
  }

  return new Response(
    streamAndCacheAudio(stream, {
      pageId,
      languageCode,
      voice,
      tone,
      estimatedMinutes,
    }),
    {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=0",
      "X-Accel-Buffering": "no",
    },
    },
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return handleAudioStream({
    pageId: searchParams.get("pageId") || undefined,
    languageCode: searchParams.get("languageCode") || undefined,
    voice: searchParams.get("voice") || undefined,
    tone: searchParams.get("tone") || undefined,
  });
}

export async function POST(req: NextRequest) {
  try {
    return handleAudioStream((await req.json()) as AudioRequest);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
