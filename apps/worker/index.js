require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const os = require("os");
const path = require("path");
const pdfParse = require("pdf-parse");
const { EPub } = require("epub2");
const canvas = require("canvas");

// PDF.js requires special handling in Node.js
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

// Initialize Supabase (Must use Service Role Key to bypass RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const CHUNK_SIZE = 1500; // Characters per page/chunk

async function processQueue() {
  console.log("Checking for pending books...");

  // 1. Fetch exactly ONE pending book
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
    // No books pending. Wait 5 seconds and check again.
    return setTimeout(processQueue, 5000);
  }

  console.log(`Processing Book ID: ${book.id} (${book.format})`);

  try {
    // 2. Lock the book so other potential worker instances don't grab it
    await supabase
      .from("books")
      .update({ status: "processing" })
      .eq("id", book.id);

    // 3. Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("library") // Replace with your actual bucket name
      .download(book.file_path);

    if (downloadError)
      throw new Error(`Download failed: ${downloadError.message}`);

    const buffer = Buffer.from(await fileData.arrayBuffer());
    let parsedData = { textChunks: [], coverBuffer: null };

    // 4. Parse based on format
    if (book.format.toLowerCase() === "pdf") {
      parsedData = await processPDF(buffer);
    } else if (book.format.toLowerCase() === "epub") {
      parsedData = await processEPUB(buffer);
    } else {
      throw new Error("Unsupported format");
    }

    // 5. Upload Cover Image (if extracted)
    let coverPath = null;
    if (parsedData.coverBuffer) {
      coverPath = `covers/${book.id}.png`;
      const { error: coverError } = await supabase.storage
        .from("library")
        .upload(coverPath, parsedData.coverBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (coverError)
        console.warn("Failed to upload cover:", coverError.message);
    }

    // 6. Bulk Insert Pages (Chunks)
    const pageInserts = parsedData.textChunks.map((text, index) => ({
      book_id: book.id,
      page_number: index + 1,
      content: text,
      token_count: Math.ceil(text.length / 4), // Rough token estimation
    }));

    // Insert in batches of 100 to avoid hitting Payload Too Large limits
    for (let i = 0; i < pageInserts.length; i += 100) {
      const batch = pageInserts.slice(i, i + 100);
      const { error: insertError } = await supabase
        .from("book_pages")
        .insert(batch);
      if (insertError)
        throw new Error(`Failed to insert pages: ${insertError.message}`);
    }

    // 7. Mark as Completed
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
    // Mark as error so it doesn't block the queue permanently
    await supabase
      .from("books")
      .update({
        status: "error",
        error_message: err.message,
      })
      .eq("id", book.id);
  }

  // Immediately check for the next book
  processQueue();
}

// --- PARSING HELPERS ---

async function processPDF(buffer) {
  console.log("Extracting PDF text...");
  const pdfData = await pdfParse(buffer);
  const textChunks = chunkText(pdfData.text);

  console.log("Extracting PDF cover...");
  let coverBuffer = null;
  try {
    // We must use a Uint8Array for PDF.js in Node
    const uint8Array = new Uint8Array(buffer);
    const pdfDoc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
    const page = await pdfDoc.getPage(1);

    // Render to Canvas
    const viewport = page.getViewport({ scale: 1.0 });
    const canvasRef = canvas.createCanvas(viewport.width, viewport.height);
    const context = canvasRef.getContext("2d");

    await page.render({ canvasContext: context, viewport: viewport }).promise;
    coverBuffer = canvasRef.toBuffer("image/png");
  } catch (e) {
    console.warn("Could not extract PDF cover:", e.message);
  }

  return { textChunks, coverBuffer };
}

async function processEPUB(buffer) {
  return new Promise((resolve, reject) => {
    // EPub parser requires a physical file path, so we write to a temp file
    const tempPath = path.join(os.tmpdir(), `temp_${Date.now()}.epub`);
    fs.writeFileSync(tempPath, buffer);

    const epub = new EPub(tempPath);

    epub.on("end", async () => {
      try {
        let fullText = "";
        let coverBuffer = null;

        // 1. Extract Text
        for (const chapter of epub.flow) {
          const chapterText = await new Promise((res) => {
            epub.getChapter(chapter.id, (err, text) => {
              if (err) res("");
              // Strip HTML tags using regex
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

        // 2. Extract Cover
        if (epub.metadata.cover) {
          coverBuffer = await new Promise((res) => {
            epub.getImage(epub.metadata.cover, (err, imgBuffer) => {
              res(err ? null : imgBuffer);
            });
          });
        }

        // Clean up temp file
        fs.unlinkSync(tempPath);

        resolve({
          textChunks: chunkText(fullText),
          coverBuffer,
        });
      } catch (err) {
        fs.unlinkSync(tempPath);
        reject(err);
      }
    });

    epub.on("error", (err) => {
      fs.unlinkSync(tempPath);
      reject(err);
    });

    epub.parse();
  });
}

// --- CHUNKING LOGIC ---
function chunkText(text) {
  // Split by paragraphs to avoid cutting sentences in half
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

// Start the worker
processQueue();
