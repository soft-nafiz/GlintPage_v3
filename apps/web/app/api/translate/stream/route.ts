import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { translatePage } from "@/lib/actions/translate";

export const runtime = "nodejs";

type TranslateStreamRequest = {
  pageId?: string;
  languageCode?: string;
  previousContext?: string;
};

function encoder() {
  const textEncoder = new TextEncoder();
  return (event: Record<string, unknown>) =>
    textEncoder.encode(`${JSON.stringify(event)}\n`);
}

function trimContext(text: string | null | undefined) {
  return String(text || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-1400);
}

async function getPreviousPageContext(
  pageId: string,
  languageCode: string,
  userId: string,
) {
  const supabase = await createClient();
  const { data: page } = await supabase
    .from("book_pages")
    .select("book_id, page_number")
    .eq("id", pageId)
    .maybeSingle();

  if (!page || page.page_number <= 1) return "";

  const { data: previousPage } = await supabase
    .from("book_pages")
    .select("id, content")
    .eq("book_id", page.book_id)
    .eq("page_number", page.page_number - 1)
    .maybeSingle();

  if (!previousPage) return "";

  const { data: userTranslation } = await supabase
    .from("translations")
    .select("translated_content")
    .eq("page_id", previousPage.id)
    .eq("language_code", languageCode)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (userTranslation?.translated_content) {
    return trimContext(userTranslation.translated_content);
  }

  const { data: globalTranslation } = await supabase
    .from("translations")
    .select("translated_content")
    .eq("page_id", previousPage.id)
    .eq("language_code", languageCode)
    .is("user_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return trimContext(globalTranslation?.translated_content || previousPage.content);
}

export async function POST(req: NextRequest) {
  let body: TranslateStreamRequest;
  try {
    body = (await req.json()) as TranslateStreamRequest;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const pageId = body.pageId;
  const languageCode = body.languageCode;
  if (!pageId || !languageCode) {
    return Response.json({ error: "Missing pageId or languageCode" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const write = encoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(write({ type: "status", status: "context" }));
        const previousContext =
          trimContext(body.previousContext) ||
          (await getPreviousPageContext(pageId, languageCode, user.id));

        controller.enqueue(write({ type: "status", status: "translating" }));
        const result = await translatePage(
          pageId,
          languageCode,
          undefined,
          false,
          previousContext,
        );

        if (result.error || !result.translation) {
          controller.enqueue(
            write({ type: "error", error: result.error || "Translation failed" }),
          );
          controller.close();
          return;
        }

        controller.enqueue(write({ type: "final", translation: result.translation }));
        controller.close();
      } catch (error) {
        controller.enqueue(
          write({
            type: "error",
            error: error instanceof Error ? error.message : "Translation failed",
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
