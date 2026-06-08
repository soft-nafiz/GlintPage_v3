const Module = require("module");
const _require = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === "canvas") return _require.call(this, "@napi-rs/canvas");
  return _require.call(this, id);
};

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { EPub } = require("epub2");
const { Jimp } = require("jimp");
const { createCanvas } = require("@napi-rs/canvas");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

pdfjsLib.GlobalWorkerOptions.workerSrc = false;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const CHUNK_SIZE = 1500;

async function processQueue() {
  const { data: book, error } = await supabase
    .from("books")
    .select("*")
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (error || !book) return setTimeout(processQueue, 5000);

  console.log(`[Worker] Processing Book ID: ${book.id} (${book.format})`);

  try {
    await supabase
      .from("books")
      .update({ status: "processing" })
      .eq("id", book.id);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("library")
      .download(book.file_path);

    if (downloadError)
      throw new Error(`Download failed: ${downloadError.message}`);

    const buffer = Buffer.from(await fileData.arrayBuffer());
    let parsedData;

    if (book.format.toLowerCase() === "pdf") {
      parsedData = await processPDF(buffer);
    } else if (book.format.toLowerCase() === "epub") {
      parsedData = await processEPUB(buffer);
    } else {
      throw new Error("Unsupported format");
    }

    if (!parsedData.chapters || parsedData.chapters.length === 0) {
      throw new Error(
        "Parsing produced 0 chapters — file may be empty or DRM-protected",
      );
    }

    // --- Save Author if Missing ---
    if (parsedData.author && !book.author) {
      await supabase
        .from("books")
        .update({ author: parsedData.author })
        .eq("id", book.id);
    }

    // --- Process Cover Art ---
    let coverUrl = null;
    if (parsedData.coverBuffer) {
      try {
        const image = await Jimp.read(parsedData.coverBuffer);
        image.resize({ w: 300 });
        const optimizedCover = await image.getBuffer("image/jpeg", {
          quality: 80,
        });
        const coverPath = `covers/${book.id}.jpg`;

        await supabase.storage
          .from("library")
          .upload(coverPath, optimizedCover, {
            contentType: "image/jpeg",
            upsert: true,
          });

        coverUrl = supabase.storage.from("library").getPublicUrl(coverPath)
          .data.publicUrl;
      } catch (coverErr) {
        console.warn("[Worker] Cover processing failed:", coverErr.message);
      }
    }

    // --- Map Chapters to Page Chunks ---
    const pageInserts = [];
    let globalPageNumber = 1;

    for (const chapter of parsedData.chapters) {
      const chunks = chunkText(chapter.text);

      for (const chunk of chunks) {
        pageInserts.push({
          book_id: book.id,
          page_number: globalPageNumber,
          chapter_number: chapter.chapter_number,
          chapter_title: chapter.title,
          content: chunk,
          token_count: Math.ceil(chunk.length / 4),
        });
        globalPageNumber++;
      }
    }

    // --- Batch Insert Pages ---
    for (let i = 0; i < pageInserts.length; i += 100) {
      const batch = pageInserts.slice(i, i + 100);
      const { error: insertError } = await supabase
        .from("book_pages")
        .insert(batch);
      if (insertError)
        throw new Error(`Batch insert failed: ${insertError.message}`);
    }

    // --- Finalize ---
    await supabase
      .from("books")
      .update({
        status: "completed",
        page_count: pageInserts.length,
        cover_url: coverUrl,
      })
      .eq("id", book.id);

    console.log(
      `✅ [Worker] Completed Book ID: ${book.id} (${parsedData.chapters.length} chapters, ${pageInserts.length} pages)`,
    );
  } catch (err) {
    console.error(`❌ [Worker] Error processing ${book.id}:`, err.message);
    await supabase
      .from("books")
      .update({ status: "failed", error_message: err.message })
      .eq("id", book.id);
  }

  setTimeout(processQueue, 1000);
}

// ─── PARSING LOGIC ────────────────────────────────────────────────────────────

async function processPDF(buffer) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const metadata = await pdf.getMetadata().catch(() => null);
  const author = metadata?.info?.Author || metadata?.info?.Creator || null;

  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const heights = textContent.items
      .map((i) => (i.transform ? Math.abs(i.transform[3]) : 0))
      .filter((h) => h > 0);
    const sorted = [...heights].sort((a, b) => a - b);
    const bodySize = sorted[Math.floor(sorted.length * 0.5)] || 12;

    let pageText = "";
    let lastY = null;

    for (const item of textContent.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const itemHeight = Math.abs(item.transform?.[3] ?? 0);
      const y = item.transform?.[5] ?? 0;
      const isHeading = itemHeight > bodySize * 1.3;
      const newLine = lastY !== null && Math.abs(y - lastY) > bodySize * 0.5;

      if (newLine) pageText += isHeading ? "\n\n" : "\n";
      else if (pageText.length > 0 && !pageText.endsWith(" ")) pageText += " ";

      pageText += isHeading ? `## ${item.str.trim()}` : item.str;
      lastY = y;
    }
    fullText += pageText.trim() + "\n\n";
  }

  fullText = fullText
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Split by headings to create chapters
  const chapterBlocks = fullText.split(/(?=## )/);
  const chapters = [];
  let chapterIndex = 1;

  for (const block of chapterBlocks) {
    if (block.trim().length < 50) continue;
    let title = `Section ${chapterIndex}`;
    let text = block.trim();

    const match = block.match(/^##\s+(.*)/);
    if (match) {
      title = match[1].trim();
      text = block.replace(/^##\s+.*(\r?\n|$)/, "").trim();
    }

    chapters.push({ chapter_number: chapterIndex, title, text });
    chapterIndex++;
  }

  let coverBuffer = null;
  try {
    coverBuffer = await extractPDFCover(buffer);
  } catch (err) {}

  return { chapters, coverBuffer, author };
}

async function processEPUB(buffer) {
  return new Promise((resolve, reject) => {
    const tempPath = path.join(os.tmpdir(), `temp_${Date.now()}.epub`);
    fs.writeFileSync(tempPath, buffer);
    const epub = new EPub(tempPath);

    epub.on("end", async () => {
      try {
        const chapters = [];
        let chapterIndex = 1;

        for (const flowItem of epub.flow) {
          const chapterText = await new Promise((res) => {
            epub.getChapter(flowItem.id, (err, text) => {
              if (err || !text) return res("");
              res(htmlToMarkdown(text).trim());
            });
          });

          if (chapterText.length > 50) {
            chapters.push({
              chapter_number: chapterIndex,
              title: flowItem.title || `Chapter ${chapterIndex}`,
              text: chapterText,
            });
            chapterIndex++;
          }
        }

        let coverBuffer = null;
        if (epub.metadata.cover) {
          coverBuffer = await new Promise((res) =>
            epub.getImage(epub.metadata.cover, (err, img) =>
              res(err ? null : img),
            ),
          );
        }

        const author = epub.metadata.creator || epub.metadata.author || null;
        resolve({ chapters, coverBuffer, author });
      } catch (err) {
        reject(err);
      } finally {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      }
    });

    epub.on("error", (err) => {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      reject(err);
    });
    epub.parse();
  });
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

async function extractPDFCover(buffer) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = createCanvas(
    Math.floor(viewport.width),
    Math.floor(viewport.height),
  );
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toBuffer("image/jpeg");
}

function chunkText(text) {
  const paragraphs = text.split(/\n+/);
  const chunks = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (
      currentChunk.length + paragraph.length > CHUNK_SIZE &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    currentChunk += paragraph + " ";
  }
  if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());
  return chunks;
}

function htmlToMarkdown(html) {
  return html
    .replace(
      /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi,
      (_, t) => `\n\n**${stripTags(t).trim()}**\n\n`,
    )
    .replace(
      /<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi,
      (_, _t, content) => `**${stripTags(content).trim()}**`,
    )
    .replace(
      /<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi,
      (_, _t, content) => `*${stripTags(content).trim()}*`,
    )
    .replace(
      /<\/p>|<\/blockquote>|<\/?(ul|ol|div|section|article)[^>]*>/gi,
      "\n\n",
    )
    .replace(/<br\s*\/?>|<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Boot
setTimeout(processQueue, 1000);
console.log("Worker booted. Listening for books...");
