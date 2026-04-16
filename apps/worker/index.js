require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const os = require("os");
const path = require("path");
const pdfParse = require("pdf-parse");
const { EPub } = require("epub2");
const Jimp = require("jimp"); // Swapped canvas for jimp

// Initialize Supabase
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

    let coverPath = null;
    if (parsedData.coverBuffer) {
      // Process cover with Jimp to ensure it's a valid, optimized image
      const image = await Jimp.read(parsedData.coverBuffer);
      const optimizedCover = await image
        .resize(300, Jimp.AUTO) // Resize to 300px width for thumbnails
        .quality(80) // Compress a bit
        .getBufferAsync(Jimp.MIME_JPEG);

      coverPath = `covers/${book.id}.jpg`;
      const { error: coverError } = await supabase.storage
        .from("library")
        .upload(coverPath, optimizedCover, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (coverError)
        console.warn("Failed to upload cover:", coverError.message);
    }

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
    }

    await supabase
      .from("books")
      .update({
        status: "completed",
        page_count: pageInserts.length,
        cover_path: coverPath,
      })
      .eq("id", book.id);

    console.log(`Successfully completed Book ID: ${book.id}`);
  } catch (err) {
    console.error(`Error processing ${book.id}:`, err.message);
    await supabase
      .from("books")
      .update({ status: "error", error_message: err.message })
      .eq("id", book.id);
  }

  processQueue();
}

// --- PARSING HELPERS ---

async function processPDF(buffer) {
  console.log("Extracting PDF text...");
  const pdfData = await pdfParse(buffer);
  const textChunks = chunkText(pdfData.text);

  // NOTE: Pure-JS PDF cover extraction is complex without Canvas.
  // We skip cover extraction for PDF for now to ensure the worker actually runs.
  return { textChunks, coverBuffer: null };
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

        for (const chapter of epub.flow) {
          const chapterText = await new Promise((res) => {
            epub.getChapter(chapter.id, (err, text) => {
              if (err) res("");
              const cleanText = text
                ? text
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()
                : "";
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

        resolve({
          textChunks: chunkText(fullText),
          coverBuffer,
        });
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
