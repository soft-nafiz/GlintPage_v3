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

    // --- Cover ---
    let coverUrl = null;
    if (parsedData.coverBuffer) {
      try {
        const image = await Jimp.fromBuffer(parsedData.coverBuffer);
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
    await supabase
      .from("books")
      .update({ status: "failed", error_message: err.message }) // ← was "error", now "failed"
      .eq("id", book.id);
  }

  processQueue();
}

// --- PARSING HELPERS ---

async function processPDF(buffer) {
  console.log("Extracting PDF text...");
  const pdfData = await pdfParse(buffer);
  const textChunks = chunkText(pdfData.text);

  let coverBuffer = null;
  try {
    coverBuffer = await extractPDFCover(buffer);
    if (coverBuffer) console.log("PDF cover extracted successfully.");
  } catch (err) {
    console.warn("PDF cover extraction failed, skipping:", err.message);
  }

  return { textChunks, coverBuffer };
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
              if (err) return res("");
              if (!text) return res("");

              // FIX: Preserve paragraph breaks BEFORE stripping tags
              const cleanText = text
                .replace(/<\/p>/gi, "\n\n") // paragraph ends → blank line
                .replace(/<br\s*\/?>/gi, "\n") // line breaks → newline
                .replace(/<\/h[1-6]>/gi, "\n\n") // headings → blank line
                .replace(/<[^>]+>/g, "") // strip remaining tags
                .replace(/[ \t]+/g, " ") // collapse spaces/tabs only
                .replace(/\n{3,}/g, "\n\n") // max 2 consecutive newlines
                .trim();

              res(cleanText + "\n\n");
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

        resolve({ textChunks, coverBuffer });
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

processQueue();
