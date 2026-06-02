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
const pdfParse = require("pdf-parse");
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
  console.log("Checking for pending books...");

  const { data: book, error } = await supabase
    .from("books")
    .select("*")
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Database error:", error.message);
    return setTimeout(processQueue, 5000);
  }

  if (!book) {
    return setTimeout(processQueue, 5000);
  }

  console.log(`Processing Book ID: ${book.id} (${book.format})`);

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
    let parsedData = { textChunks: [], coverBuffer: null };

    if (book.format.toLowerCase() === "pdf") {
      parsedData = await processPDF(buffer);
    } else if (book.format.toLowerCase() === "epub") {
      parsedData = await processEPUB(buffer);
    } else {
      throw new Error("Unsupported format");
    }

    console.log(`Chunks produced: ${parsedData.textChunks.length}`);

    if (parsedData.textChunks.length === 0) {
      throw new Error(
        "Parsing produced 0 chunks — file may be empty or DRM-protected",
      );
    }

    const extractedAuthor = parsedData.author ?? null;
    if (extractedAuthor && !book.author) {
      await supabase
        .from("books")
        .update({ author: extractedAuthor })
        .eq("id", book.id);
      console.log(`Author extracted: ${extractedAuthor}`);
    }
    // --- Cover ---
    let coverUrl = null;
    if (parsedData.coverBuffer) {
      try {
        const image = await Jimp.read(parsedData.coverBuffer);
        image.resize({ w: 300 });
        const optimizedCover = await image.getBuffer("image/jpeg", {
          quality: 80,
        });

        const coverPath = `covers/${book.id}.jpg`;
        const { error: coverError } = await supabase.storage
          .from("library")
          .upload(coverPath, optimizedCover, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (coverError) {
          console.warn("Failed to upload cover:", coverError.message);
        } else {
          // Store the full public URL, not just the path
          const { data: urlData } = supabase.storage
            .from("library")
            .getPublicUrl(coverPath);
          coverUrl = urlData.publicUrl;
          console.log(`Cover uploaded: ${coverUrl}`);
        }
      } catch (coverErr) {
        console.warn("Cover processing failed, skipping:", coverErr.message);
      }
    }

    // --- Pages ---
    const pageInserts = parsedData.textChunks.map((text, index) => ({
      book_id: book.id,
      page_number: index + 1,
      content: text,
      token_count: Math.ceil(text.length / 4),
    }));

    for (let i = 0; i < pageInserts.length; i += 100) {
      const batch = pageInserts.slice(i, i + 100);
      const { error: insertError } = await supabase
        .from("book_pages")
        .insert(batch);
      if (insertError)
        throw new Error(`Failed to insert pages: ${insertError.message}`);
      console.log(
        `Inserted pages ${i + 1}–${Math.min(i + 100, pageInserts.length)}`,
      );
    }

    // --- Final update ---
    const { error: finalError } = await supabase
      .from("books")
      .update({
        status: "completed",
        page_count: pageInserts.length,
        cover_url: coverUrl,
      })
      .eq("id", book.id);

    if (finalError)
      throw new Error(`Final update failed: ${finalError.message}`);

    console.log(
      `✅ Successfully completed Book ID: ${book.id} — ${pageInserts.length} pages`,
    );
  } catch (err) {
    console.error(`❌ Error processing ${book.id}:`, err.message);
    try {
      await supabase
        .from("books")
        .update({ status: "failed", error_message: err.message })
        .eq("id", book.id);
    } catch (fallbackErr) {
      console.error(
        "CRITICAL: Failed to update error status!",
        fallbackErr.message,
      );
    }
  }

  setTimeout(processQueue, 1000);
}

// --- PARSING HELPERS ---

async function processPDF(buffer) {
  console.log("Extracting PDF text...");

  // Use pdfjs for structured extraction
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;

  // Extract author from metadata
  const metadata = await pdf.getMetadata().catch(() => null);
  const author = metadata?.info?.Author || metadata?.info?.Creator || null;

  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Calculate the most common font height (body text baseline)
    const heights = textContent.items
      .map((item) => (item.transform ? Math.abs(item.transform[3]) : 0))
      .filter((h) => h > 0);
    const sorted = [...heights].sort((a, b) => a - b);
    const bodySize = sorted[Math.floor(sorted.length * 0.5)] || 12; // median

    let pageText = "";
    let lastY = null;

    for (const item of textContent.items) {
      if (!("str" in item) || !item.str.trim()) continue;

      const itemHeight = Math.abs(item.transform?.[3] ?? 0);
      const y = item.transform?.[5] ?? 0;

      // Detect heading: significantly larger than body text
      const isHeading = itemHeight > bodySize * 1.3;

      // Detect new line by Y position change
      const newLine = lastY !== null && Math.abs(y - lastY) > bodySize * 0.5;

      if (newLine) {
        pageText += isHeading ? "\n\n" : "\n";
      } else if (pageText.length > 0 && !pageText.endsWith(" ")) {
        pageText += " ";
      }

      if (isHeading) {
        // Wrap heading in markdown
        pageText += `## ${item.str.trim()}`;
      } else {
        pageText += item.str;
      }

      lastY = y;
    }

    fullText += pageText.trim() + "\n\n";
  }

  // Clean up
  fullText = fullText
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const textChunks = chunkText(fullText);

  let coverBuffer = null;
  try {
    coverBuffer = await extractPDFCover(buffer);
    if (coverBuffer) console.log("PDF cover extracted successfully.");
  } catch (err) {
    console.warn("PDF cover extraction failed, skipping:", err.message);
  }

  return { textChunks, coverBuffer, author };
}

async function extractPDFCover(buffer) {
  // Load the PDF
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  // Render at 1.5x scale for a decent resolution thumbnail
  const scale = 1.5;
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(
    Math.floor(viewport.width),
    Math.floor(viewport.height),
  );
  const ctx = canvas.getContext("2d");

  await page.render({ canvasContext: ctx, viewport }).promise;

  // Return as raw JPEG buffer — Jimp will resize it in the main flow
  return canvas.toBuffer("image/jpeg");
}

function htmlToMarkdown(html) {
  return (
    html
      // Headings → markdown headings (keep them readable as-is)
      .replace(
        /<h1[^>]*>([\s\S]*?)<\/h1>/gi,
        (_, t) => `\n\n# ${stripTags(t).trim()}\n\n`,
      )
      .replace(
        /<h2[^>]*>([\s\S]*?)<\/h2>/gi,
        (_, t) => `\n\n## ${stripTags(t).trim()}\n\n`,
      )
      .replace(
        /<h3[^>]*>([\s\S]*?)<\/h3>/gi,
        (_, t) => `\n\n### ${stripTags(t).trim()}\n\n`,
      )
      .replace(
        /<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi,
        (_, t) => `\n\n#### ${stripTags(t).trim()}\n\n`,
      )

      // Inline formatting
      .replace(
        /<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi,
        (_, _t, content) => `**${stripTags(content).trim()}**`,
      )
      .replace(
        /<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi,
        (_, _t, content) => `*${stripTags(content).trim()}*`,
      )

      // Block elements → paragraph breaks
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/blockquote>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<\/?(ul|ol|div|section|article)[^>]*>/gi, "\n\n")

      // Strip all remaining tags
      .replace(/<[^>]+>/g, "")

      // Clean up whitespace
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^ +/gm, "") // remove leading spaces per line
      .trim()
  );
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function processEPUB(buffer) {
  return new Promise((resolve, reject) => {
    const tempPath = path.join(os.tmpdir(), `temp_${Date.now()}.epub`);
    fs.writeFileSync(tempPath, buffer);

    const epub = new EPub(tempPath);

    epub.on("end", async () => {
      try {
        let fullText = "";
        let coverBuffer = null;

        console.log(`EPUB chapters found: ${epub.flow.length}`);

        for (const chapter of epub.flow) {
          const chapterText = await new Promise((res) => {
            epub.getChapter(chapter.id, (err, text) => {
              if (err || !text) return res("");
              const markdown = htmlToMarkdown(text);
              res(markdown + "\n\n");
            });
          });
          fullText += chapterText;
        }

        if (epub.metadata.cover) {
          coverBuffer = await new Promise((res) => {
            epub.getImage(epub.metadata.cover, (err, imgBuffer) => {
              res(err ? null : imgBuffer);
            });
          });
        }

        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

        const textChunks = chunkText(fullText);
        console.log(
          `Full text length: ${fullText.length} chars, ${textChunks.length} chunks`,
        );

        const author = epub.metadata.creator || epub.metadata.author || null;

        resolve({ textChunks, coverBuffer, author });
      } catch (err) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        reject(err);
      }
    });

    epub.on("error", (err) => {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      reject(err);
    });

    epub.parse();
  });
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

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

setTimeout(processQueue, 1000);
