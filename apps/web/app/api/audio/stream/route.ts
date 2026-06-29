import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

export const runtime = "nodejs";

const LANGUAGE_VOICES: Record<string, string> = {
  none:       "en-US-AriaNeural",
  Bengali:    "bn-IN-TanishaaNeural",
  Spanish:    "es-ES-ElviraNeural",
  French:     "fr-FR-DeniseNeural",
  Arabic:     "ar-SA-ZariyahNeural",
  Hindi:      "hi-IN-SwaraNeural",
  Portuguese: "pt-BR-FranciscaNeural",
  Russian:    "ru-RU-SvetlanaNeural",
  Japanese:   "ja-JP-NanamiNeural",
  German:     "de-DE-KatjaNeural",
  Chinese:    "zh-CN-XiaoxiaoNeural",
  Turkish:    "tr-TR-EmelNeural",
  Korean:     "ko-KR-SunHiNeural",
  Italian:    "it-IT-ElsaNeural",
};

const VOICE_ALIASES: Record<string, string> = {
  alloy:    "en-US-AriaNeural",
  ash:      "en-US-GuyNeural",
  ballad:   "en-US-AndrewNeural",
  coral:    "en-US-EricaNeural",
  echo:     "en-US-BrianNeural",
  fable:    "en-US-ChristopherNeural",
  nova:     "en-US-JennyNeural",
  onyx:     "en-US-DavisNeural",
  sage:     "en-US-EmmaNeural",
  shimmer:  "en-US-MichelleNeural",
};

const TONE_PROSODY: Record<string, { rate: string; pitch: string; volume: string }> = {
  narrator:       { rate: "+0%",  pitch: "+0Hz", volume: "+0%" },
  dramatic:       { rate: "-5%",  pitch: "+15Hz", volume: "+5%" },
  calm:           { rate: "-20%", pitch: "-5Hz", volume: "-5%" },
  academic:       { rate: "-10%", pitch: "+0Hz", volume: "+0%" },
  conversational: { rate: "+5%",  pitch: "+0Hz", volume: "+0%" },
};

type AudioRequest = {
  pageId?: string;
  languageCode?: string;
  voice?: string;
  tone?: string;
};

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

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

  if (pageError) return { error: "Unable to load page.", status: 500 };
  if (!page) return { error: "Page not found.", status: 404 };

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id")
    .eq("id", page.book_id)
    .eq("status", "completed")
    .or(`user_id.eq.${userId},is_public.eq.true`)
    .maybeSingle();

  if (bookError) return { error: "Unable to verify book access.", status: 500 };
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

  return { error: "TRANSLATION_REQUIRED", status: 409 };
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

function selectVoice(languageCode: string, voiceParam?: string): string {
  if (voiceParam && voiceParam.includes("-") && voiceParam.endsWith("Neural")) {
    return voiceParam;
  }
  if (languageCode && languageCode !== "none" && LANGUAGE_VOICES[languageCode]) {
    return LANGUAGE_VOICES[languageCode];
  }
  if (voiceParam && VOICE_ALIASES[voiceParam]) {
    return VOICE_ALIASES[voiceParam];
  }
  return LANGUAGE_VOICES.none;
}

function chunkText(text: string, maxChars = 2800): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = "";
  for (const para of paragraphs) {
    if (para.length > maxChars) {
      if (current.trim()) { chunks.push(current.trim()); current = ""; }
      const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
      for (const sentence of sentences) {
        if (sentence.length > maxChars) {
          for (let i = 0; i < sentence.length; i += maxChars) {
            chunks.push(sentence.slice(i, i + maxChars).trim());
          }
          continue;
        }
        if ((current + sentence).length > maxChars) {
          if (current.trim()) chunks.push(current.trim());
          current = sentence;
        } else {
          current += sentence;
        }
      }
    } else if ((current + "\n\n" + para).length > maxChars) {
      if (current.trim()) chunks.push(current.trim());
      current = para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

async function generateEdgeTtsBuffer(
  text: string,
  voice: string,
  tone: string,
): Promise<Buffer> {
  const chunks = chunkText(text);
  const prosody = TONE_PROSODY[tone] ?? TONE_PROSODY.narrator;
  const buffers: Buffer[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = escapeXml(chunks[i]);
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      
      const tempDir = path.join(os.tmpdir(), `tts_chunk_${Date.now()}_${i}`);
      await fs.mkdir(tempDir, { recursive: true });
      
      await tts.toFile(tempDir, chunk, {
        rate: prosody.rate,
        pitch: prosody.pitch,
        volume: prosody.volume,
      });

      const filePath = path.join(tempDir, "audio.mp3");
      const fileBuffer = await fs.readFile(filePath);
      buffers.push(fileBuffer);

      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    } finally {
      try { tts.close(); } catch {}
    }
  }

  const finalBuffer = Buffer.concat(buffers);
  if (finalBuffer.length === 0) {
    throw new Error("TTS generation failed: No audio data received.");
  }
  return finalBuffer;
}

async function handleAudioStream(body: AudioRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const pageId = body.pageId;
  const languageCode = body.languageCode ?? "none";
  const voice = selectVoice(languageCode, body.voice);
  const tone = body.tone || "narrator";

  if (!pageId) {
    return NextResponse.json({ error: "Missing pageId" }, { status: 400 });
  }

  const readablePage = await getReadablePage(supabase, user.id, pageId);
  if ("error" in readablePage) {
    return NextResponse.json({ error: readablePage.error }, { status: readablePage.status });
  }

  const textResult = await getAudioText(pageId, languageCode, user.id, readablePage.content);
  if ("error" in textResult) {
    return NextResponse.json({ error: textResult.error }, { status: textResult.status });
  }

  if (!textResult.text.trim()) {
    return NextResponse.json({ error: "No text content to synthesize." }, { status: 400 });
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

  const wordCount = textResult.text.trim().split(/\s+/).filter(Boolean).length;
  const estimatedMinutes = Math.max(wordCount / 150, 0.1);
  
  const { data: quota, error: rpcError } = await supabase.rpc(
    "check_and_increment_audio",
    { u_id: user.id, estimated_minutes: estimatedMinutes },
  );

  if (rpcError) {
    return NextResponse.json({ error: "Failed to check audio quota." }, { status: 500 });
  }

  if (!quota?.allowed) {
    return NextResponse.json({ error: quota?.reason || "AUDIO_LIMIT_REACHED" }, { status: 403 });
  }

  let audioBuffer: Buffer;
  try {
    audioBuffer = await generateEdgeTtsBuffer(textResult.text, voice, tone);
  } catch (error) {
    console.error("[audio] Edge TTS generation failed:", error);
    await supabase.rpc("reverse_audio_deduction", {
      u_id: user.id,
      minutes_to_refund: estimatedMinutes,
    });
    return NextResponse.json(
      { error: "Audio generation failed. Quota refunded." },
      { status: 502 },
    );
  }

  const exactDurationSecs = Math.round((audioBuffer.length * 8) / 96000);
  const actualMinutes = Math.max(exactDurationSecs / 60, 0.1);
  
  const minuteDifference = actualMinutes - estimatedMinutes;
  if (Math.abs(minuteDifference) > 0.05) {
    if (minuteDifference < 0) {
      await supabase.rpc("reverse_audio_deduction", {
        u_id: user.id,
        minutes_to_refund: Math.abs(minuteDifference),
      });
    } else {
      const { error: adjustError } = await supabase.rpc("check_and_increment_audio", {
        u_id: user.id,
        estimated_minutes: minuteDifference,
      });
      if (adjustError) console.error("[audio] Quota adjustment failed:", adjustError.message);
    }
  }

  const fileName = `audio/${pageId}_${languageCode}_${voice}_${tone}.mp3`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("library")
    .upload(fileName, audioBuffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: "Failed to save audio file." }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage
    .from("library")
    .getPublicUrl(fileName);

  const { error: dbInsertError } = await supabaseAdmin
    .from("audio_pages")
    .insert({
      page_id: pageId,
      language_code: languageCode,
      voice,
      tone,
      audio_url: urlData.publicUrl,
      duration_secs: exactDurationSecs,
    });

  if (dbInsertError) {
    console.error("[audio] DB cache upsert failed:", dbInsertError.message);
  }

  return NextResponse.redirect(urlData.publicUrl, { status: 302 });
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
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}