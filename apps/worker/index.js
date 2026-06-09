const Module = require("module");
const _require = Module.prototype.require;
Module.prototype.require = function patchedRequire(id) {
  if (id === "canvas") return _require.call(this, "@napi-rs/canvas");
  return _require.call(this, id);
};

const { createClient } = require("@supabase/supabase-js");
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();
const { EPub } = require("epub2");
const { Jimp } = require("jimp");
const { createCanvas } = require("@napi-rs/canvas");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

pdfjsLib.GlobalWorkerOptions.workerSrc = false;

let supabaseClient;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return supabaseClient;
}

const BOOK_STORAGE_BUCKET =
  process.env.SUPABASE_BOOK_BUCKET || process.env.SUPABASE_STORAGE_BUCKET || "library";
const ASSET_STORAGE_BUCKET =
  process.env.SUPABASE_ASSET_BUCKET || process.env.SUPABASE_STORAGE_BUCKET || "library";

const PAGE_MIN_CHARS = Number(process.env.PAGE_MIN_CHARS || 1500);
const PAGE_MAX_CHARS = Number(process.env.PAGE_MAX_CHARS || 3000);
const POLL_IDLE_MS = Number(process.env.WORKER_POLL_IDLE_MS || 5000);
const POLL_NEXT_MS = Number(process.env.WORKER_POLL_NEXT_MS || 1000);
const PDF_PIPELINE = (process.env.PDF_PIPELINE || "python").toLowerCase();
const PDF_FALLBACK_PIPELINE = (process.env.PDF_FALLBACK_PIPELINE || "").toLowerCase();
const PYTHON_VENDOR_PATH = path.join(__dirname, "python_vendor");

async function processQueue() {
  const supabase = getSupabase();

  const { data: book, error } = await supabase
    .from("books")
    .select("*")
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Worker] Failed to fetch pending book:", error.message);
    return setTimeout(processQueue, POLL_IDLE_MS);
  }

  if (!book) return setTimeout(processQueue, POLL_IDLE_MS);

  console.log(`[Worker] Processing book ${book.id} (${book.format})`);

  try {
    await supabase.from("books").update({ status: "processing" }).eq("id", book.id);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BOOK_STORAGE_BUCKET)
      .download(book.file_path);

    if (downloadError) throw new Error(`Download failed: ${downloadError.message}`);

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const format = String(book.format || "").toLowerCase();
    let parsedData;

    if (format === "pdf") {
      parsedData = await processPDF(buffer, { bookId: book.id });
    } else if (format === "epub") {
      parsedData = await processEPUB(buffer, { bookId: book.id });
    } else {
      throw new Error(`Unsupported format: ${book.format}`);
    }

    if (!parsedData.chapters?.length) {
      throw new Error("Parsing produced 0 chapters; file may be empty, scanned, or DRM-protected");
    }

    if (parsedData.author && !book.author) {
      await supabase.from("books").update({ author: parsedData.author }).eq("id", book.id);
    }

    const coverUrl = parsedData.coverBuffer
      ? await uploadOptimizedCover(book.id, parsedData.coverBuffer).catch((err) => {
          console.warn("[Worker] Cover processing failed:", err.message);
          return null;
        })
      : null;

    const pageInserts = buildPageRows(book.id, parsedData.chapters);

    await supabase.from("book_pages").delete().eq("book_id", book.id);

    for (let i = 0; i < pageInserts.length; i += 100) {
      const batch = pageInserts.slice(i, i + 100);
      const { error: insertError } = await supabase.from("book_pages").insert(batch);
      if (insertError) throw new Error(`Batch insert failed: ${insertError.message}`);
    }

    await supabase
      .from("books")
      .update({
        status: "completed",
        page_count: pageInserts.length,
        cover_url: coverUrl || book.cover_url || null,
        error_message: null,
      })
      .eq("id", book.id);

    console.log(
      `[Worker] Completed ${book.id}: ${parsedData.chapters.length} chapters, ${pageInserts.length} pages`,
    );
  } catch (err) {
    console.error(`[Worker] Error processing ${book.id}:`, err.message);
    await supabase
      .from("books")
      .update({ status: "failed", error_message: err.message })
      .eq("id", book.id);
  }

  setTimeout(processQueue, POLL_NEXT_MS);
}

async function processEPUB(buffer, { bookId } = {}) {
  const tempPath = path.join(os.tmpdir(), `glintpage_${Date.now()}_${crypto.randomUUID()}.epub`);
  await fsp.writeFile(tempPath, buffer);

  return new Promise((resolve, reject) => {
    const epub = new EPub(tempPath);

    epub.on("end", async () => {
      try {
        const chapters = [];
        let chapterNumber = 1;

        for (const flowItem of epub.flow || []) {
          const html = await getEpubChapter(epub, flowItem.id);
          if (!html.trim()) continue;

          const markdown = await epubHtmlToMarkdown(epub, html, {
            bookId,
            chapterHref: flowItem.href,
          });

          if (markdown.length < 20) continue;

          chapters.push({
            chapter_number: chapterNumber,
            title: flowItem.title || inferMarkdownTitle(markdown) || `Chapter ${chapterNumber}`,
            text: markdown,
          });
          chapterNumber += 1;
        }

        const coverBuffer = await extractEpubCover(epub);
        const author = epub.metadata?.creator || epub.metadata?.author || null;

        resolve({ chapters, coverBuffer, author });
      } catch (err) {
        reject(err);
      } finally {
        cleanupTempFile(tempPath);
      }
    });

    epub.on("error", (err) => {
      cleanupTempFile(tempPath);
      reject(err);
    });

    epub.parse();
  });
}

async function epubHtmlToMarkdown(epub, html, { bookId, chapterHref }) {
  const { unified } = await import("unified");
  const rehypeParse = (await import("rehype-parse")).default;
  const rehypeRemark = (await import("rehype-remark")).default;
  const remarkGfm = (await import("remark-gfm")).default;
  const remarkStringify = (await import("remark-stringify")).default;
  const { visit } = await import("unist-util-visit");

  const processor = unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeRemark)
    .use(remarkGfm)
    .use(remarkStringify, {
      bullet: "-",
      fences: true,
      rule: "-",
      emphasis: "*",
      strong: "*",
    });

  const tree = processor.parse(html);
  const imageUploads = [];

  visit(tree, "element", (node) => {
    if (node.tagName !== "img") return;

    const src = String(node.properties?.src || node.properties?.["data-src"] || "").trim();
    if (!src || src.startsWith("data:")) return;

    imageUploads.push(
      rewriteEpubImageSource(epub, node, src, { bookId, chapterHref }).catch((err) => {
        console.warn(`[Worker] EPUB image skipped (${src}): ${err.message}`);
      }),
    );
  });

  await Promise.all(imageUploads);

  const mdast = await processor.run(tree);
  return processor
    .stringify(mdast)
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

async function rewriteEpubImageSource(epub, node, src, { bookId, chapterHref }) {
  const candidates = buildEpubAssetCandidates(epub, src, chapterHref);
  const asset = await getEpubBinaryAsset(epub, candidates);

  if (!asset?.buffer) throw new Error("binary asset not found in archive");

  const cdnUrl = await uploadBookAsset({
    bookId,
    sourceName: src,
    buffer: asset.buffer,
    contentType: asset.contentType || inferContentType(src, asset.buffer),
  });

  node.properties.src = cdnUrl;
}

async function processPDF(buffer, options = {}) {
  let elements;

  if (PDF_PIPELINE === "unstructured") {
    elements = await processPDFWithUnstructured(buffer);
  } else if (PDF_PIPELINE === "pdfjs") {
    elements = await processPDFWithPdfJs(buffer);
  } else if (PDF_PIPELINE === "python") {
    elements = await processPDFWithPythonBridge(buffer).catch((bridgeErr) =>
      processPDFFallback(buffer, bridgeErr),
    );
  } else {
    throw new Error(`Unsupported PDF_PIPELINE "${PDF_PIPELINE}". Use python, unstructured, or pdfjs.`);
  }

  const chapters = structuredPdfElementsToChapters(elements);
  const metadata = await readPDFMetadata(buffer);
  const coverBuffer = await extractPDFCover(buffer).catch(() => null);

  return {
    chapters,
    coverBuffer,
    author: metadata?.info?.Author || metadata?.info?.Creator || null,
    bookId: options.bookId,
  };
}

async function processPDFFallback(buffer, bridgeErr) {
  if (PDF_FALLBACK_PIPELINE === "unstructured") {
    console.warn("[Worker] Python PDF bridge failed; explicitly falling back to Unstructured:", bridgeErr.message);
    return processPDFWithUnstructured(buffer);
  }

  if (PDF_FALLBACK_PIPELINE === "pdfjs") {
    console.warn("[Worker] Python PDF bridge failed; explicitly falling back to pdfjs:", bridgeErr.message);
    return processPDFWithPdfJs(buffer);
  }

  throw new Error(
    [
      `Python PDF bridge failed: ${bridgeErr.message}`,
      "PDF_PIPELINE defaults to python and no fallback is enabled.",
      "Install python3 plus PyMuPDF in the worker image, or set PYTHON_BIN to the Python executable.",
      "Only set PDF_FALLBACK_PIPELINE=unstructured or pdfjs if you intentionally want a fallback.",
    ].join(" "),
  );
}

async function processPDFWithPythonBridge(buffer) {
  const tempPath = path.join(os.tmpdir(), `glintpage_${Date.now()}_${crypto.randomUUID()}.pdf`);
  await fsp.writeFile(tempPath, buffer);

  const pythonScript = String.raw`
import json
import statistics
import sys

try:
    import fitz
except Exception as exc:
    raise SystemExit(json.dumps({"error": "PyMuPDF is required for PDF_PIPELINE=python: " + str(exc)}))

doc = fitz.open(sys.argv[1])
elements = []

for page_index, page in enumerate(doc, start=1):
    page_dict = page.get_text("dict")
    raw_blocks = []
    all_sizes = []

    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:
            continue

        lines = []
        sizes = []
        flags = []
        for line in block.get("lines", []):
            line_text = ""
            for span in line.get("spans", []):
                text = span.get("text", "")
                if text.strip():
                    line_text += text
                    sizes.append(float(span.get("size", 0) or 0))
                    flags.append(int(span.get("flags", 0) or 0))
            if line_text.strip():
                lines.append(line_text.strip())

        text = " ".join(lines).strip()
        if not text:
            continue

        all_sizes.extend([s for s in sizes if s > 0])
        raw_blocks.append({
            "text": text,
            "bbox": block.get("bbox", [0, 0, 0, 0]),
            "size": max(sizes) if sizes else 0,
            "bold": any((flag & 16) for flag in flags),
        })

    baseline = statistics.median(all_sizes) if all_sizes else 12

    # Stable reading order: top-to-bottom first, then left-to-right within the same visual band.
    raw_blocks.sort(key=lambda item: (round(item["bbox"][1] / max(baseline, 1)), item["bbox"][0]))

    for block in raw_blocks:
        text = " ".join(block["text"].split())
        is_title = (
            block["size"] >= baseline * 1.22
            and len(text) <= 180
        ) or (block["bold"] and block["size"] >= baseline * 1.08 and len(text) <= 120)

        elements.append({
            "type": "Title" if is_title else "BodyText",
            "text": text,
            "page_number": page_index,
        })

print(json.dumps(elements, ensure_ascii=False))
`;

  try {
    const stdout = await spawnPythonBuffered(["-c", pythonScript, tempPath]);
    const parsed = JSON.parse(stdout);
    if (parsed?.error) throw new Error(parsed.error);
    if (!Array.isArray(parsed)) throw new Error("Python bridge returned invalid JSON");
    return parsed;
  } finally {
    cleanupTempFile(tempPath);
  }
}

async function processPDFWithPdfJs(buffer) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const elements = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items
      .filter((item) => "str" in item && String(item.str).trim())
      .map((item) => ({
        text: String(item.str).trim(),
        x: item.transform?.[4] || 0,
        y: item.transform?.[5] || 0,
        size: Math.abs(item.transform?.[3] || 0) || 12,
      }));

    if (!items.length) continue;

    const sizes = items.map((item) => item.size).sort((a, b) => a - b);
    const baseline = sizes[Math.floor(sizes.length * 0.5)] || 12;
    const lines = [];

    for (const item of items.sort((a, b) => b.y - a.y || a.x - b.x)) {
      const previous = lines[lines.length - 1];
      if (!previous || Math.abs(previous.y - item.y) > baseline * 0.45) {
        lines.push({ y: item.y, size: item.size, parts: [item] });
      } else {
        previous.parts.push(item);
        previous.size = Math.max(previous.size, item.size);
      }
    }

    for (const line of lines) {
      const text = line.parts
        .sort((a, b) => a.x - b.x)
        .map((item) => item.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (!text) continue;

      elements.push({
        type: line.size >= baseline * 1.25 && text.length <= 160 ? "Title" : "BodyText",
        text,
        page_number: pageNum,
      });
    }
  }

  return elements;
}

async function processPDFWithUnstructured(buffer) {
  if (!process.env.UNSTRUCTURED_API_KEY) {
    throw new Error("UNSTRUCTURED_API_KEY is required for PDF_PIPELINE=unstructured");
  }

  const form = new FormData();
  form.append("files", new Blob([buffer], { type: "application/pdf" }), "book.pdf");
  form.append("strategy", process.env.UNSTRUCTURED_STRATEGY || "hi_res");
  form.append("coordinates", "true");
  form.append("languages", process.env.UNSTRUCTURED_LANGUAGES || "eng");

  const endpoint =
    process.env.UNSTRUCTURED_API_URL || "https://api.unstructuredapp.io/general/v0/general";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "unstructured-api-key": process.env.UNSTRUCTURED_API_KEY },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Unstructured PDF partition failed: ${response.status} ${await response.text()}`);
  }

  const elements = await response.json();
  return elements
    .map((element) => ({
      type: element.type === "Title" ? "Title" : "BodyText",
      text: String(element.text || "").trim(),
      page_number: element.metadata?.page_number || null,
    }))
    .filter((element) => element.text);
}

function structuredPdfElementsToChapters(elements) {
  const chapters = [];
  let current = null;

  for (const element of elements) {
    const text = normalizeText(element.text);
    if (!text) continue;

    if (element.type === "Title") {
      if (current?.blocks.length) chapters.push(finalizePdfChapter(current, chapters.length + 1));
      current = { title: text, blocks: [`## ${text}`] };
      continue;
    }

    if (!current) current = { title: "Section 1", blocks: [] };
    current.blocks.push(text);
  }

  if (current?.blocks.length) chapters.push(finalizePdfChapter(current, chapters.length + 1));
  return chapters.length ? chapters : [{ chapter_number: 1, title: "Section 1", text: "" }];
}

function finalizePdfChapter(chapter, chapterNumber) {
  return {
    chapter_number: chapterNumber,
    title: chapter.title || `Section ${chapterNumber}`,
    text: chapter.blocks.join("\n\n").trim(),
  };
}

function buildPageRows(bookId, chapters) {
  const rows = [];
  let pageNumber = 1;

  for (const chapter of chapters) {
    const pages = chunkToStrictCharacterPages(chapter.text, {
      minChars: PAGE_MIN_CHARS,
      maxChars: PAGE_MAX_CHARS,
    });

    for (const content of pages) {
      rows.push({
        book_id: bookId,
        page_number: pageNumber,
        chapter_number: chapter.chapter_number,
        chapter_title: chapter.title,
        content,
        token_count: Math.ceil(content.length / 4),
      });
      pageNumber += 1;
    }
  }

  return rows;
}

function chunkToStrictCharacterPages(markdown, options = {}) {
  const minChars = options.minChars || PAGE_MIN_CHARS;
  const maxChars = options.maxChars || PAGE_MAX_CHARS;
  const softTargetChars = options.softTargetChars || Math.floor((minChars + maxChars) / 2);
  const blocks = splitMarkdownBlocks(markdown);
  const pages = [];
  let current = "";

  const flush = () => {
    if (!current.trim()) return;
    pages.push(current.trim());
    current = "";
  };

  const append = (piece) => {
    current = current ? `${current}\n\n${piece}` : piece;
  };

  for (const block of blocks) {
    const isAtomic = isAtomicMarkdownBlock(block);

    /*
     * Markdown headings, image tags, GFM tables, and fenced code are structural
     * atoms. The assembler never splits them by character index because cutting
     * the middle of "## Title", "![alt](cdn-url)", a table delimiter row, or a
     * code fence would corrupt the renderer on the reader client. Oversized
     * atoms are therefore emitted as a single page, even when they exceed
     * maxChars.
     */
    if (isAtomic) {
      const joinedLength = joinedMarkdownLength(current, block);
      if (current && joinedLength > maxChars) flush();
      append(block);
      if (block.length > maxChars || current.length >= softTargetChars) flush();
      continue;
    }

    for (const piece of splitReadableMarkdownBlock(block, softTargetChars)) {
      const joinedLength = joinedMarkdownLength(current, piece);

      if (current && joinedLength > maxChars) {
        flush();
      }

      /*
       * Non-atomic text is already split by sentence and then by inline Markdown
       * tokens. Tokens such as **bold**, `code`, [links](url), and ![images](url)
       * are carried whole, so a page boundary can land between tokens but never
       * inside the syntax that the client has to render.
       */
      append(piece);

      if (current.length >= softTargetChars) flush();
    }

    if (current.length >= softTargetChars) flush();
  }

  flush();
  return pages;
}

function splitMarkdownBlocks(markdown) {
  return String(markdown || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function isAtomicMarkdownBlock(block) {
  return (
    /^#{1,6}\s+\S/.test(block) ||
    /^!\[[^\]]*]\([^)]+\)\s*$/.test(block) ||
    isGfmTableBlock(block) ||
    /^```[\s\S]*```$/.test(block)
  );
}

function isGfmTableBlock(block) {
  const lines = block.split("\n").map((line) => line.trim());
  return (
    lines.length >= 2 &&
    lines[0].includes("|") &&
    /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[1])
  );
}

function splitReadableMarkdownBlock(block, maxChars) {
  if (block.length <= maxChars) return [block];

  if (/^\s*(?:[-*+]|\d+\.)\s+/m.test(block)) {
    return splitByLineBoundaries(block, maxChars);
  }

  const sentences = splitSentences(block);
  const pieces = [];
  let current = "";

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current) {
        pieces.push(current.trim());
        current = "";
      }
      pieces.push(...splitInlineMarkdownSafely(sentence, maxChars));
      continue;
    }

    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > maxChars && current) {
      pieces.push(current.trim());
      current = sentence;
    } else {
      current = next;
    }
  }

  if (current.trim()) pieces.push(current.trim());
  return pieces;
}

function splitByLineBoundaries(block, maxChars) {
  const pieces = [];
  let current = "";

  for (const line of block.split("\n").map((item) => item.trim()).filter(Boolean)) {
    if (line.length > maxChars) {
      if (current) {
        pieces.push(current.trim());
        current = "";
      }
      pieces.push(...splitInlineMarkdownSafely(line, maxChars));
      continue;
    }

    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxChars && current) {
      pieces.push(current.trim());
      current = line;
    } else {
      current = next;
    }
  }

  if (current.trim()) pieces.push(current.trim());
  return pieces;
}

function splitSentences(text) {
  const matches = String(text).match(/[^.!?。！？।]+[.!?。！？।]*["')\]]*|[^\s]+/g);
  return (matches || [text]).map((part) => part.trim()).filter(Boolean);
}

function splitInlineMarkdownSafely(text, maxChars) {
  const tokens = tokenizeInlineMarkdown(text);
  const pieces = [];
  let current = "";

  for (const token of tokens) {
    if (!token) continue;

    if (token.length > maxChars) {
      if (current.trim()) {
        pieces.push(current.trim());
        current = "";
      }
      pieces.push(token.trim());
      continue;
    }

    const spacer = current && !/^\s/.test(token) ? " " : "";
    const next = `${current}${spacer}${token}`.trimStart();

    if (next.length > maxChars && current.trim()) {
      pieces.push(current.trim());
      current = token.trimStart();
    } else {
      current = next;
    }
  }

  if (current.trim()) pieces.push(current.trim());
  return pieces;
}

function tokenizeInlineMarkdown(text) {
  const pattern =
    /!\[[^\]]*]\([^)]+\)|\[[^\]]+]\([^)]+\)|\*\*[^*]+?\*\*|__[^_]+?__|`[^`]+?`|~~[^~]+?~~|\*[^*\s][^*]*?\*|_[^_\s][^_]*?_/g;
  const tokens = [];
  let cursor = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) tokens.push(...splitPlainTextTokens(text.slice(cursor, match.index)));
    tokens.push(match[0]);
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) tokens.push(...splitPlainTextTokens(text.slice(cursor)));
  return tokens;
}

function splitPlainTextTokens(text) {
  return String(text).match(/\S+|\s+/g) || [];
}

function joinedMarkdownLength(current, next) {
  return current ? current.length + 2 + next.length : next.length;
}

async function getEpubChapter(epub, id) {
  return new Promise((resolve) => {
    epub.getChapter(id, (err, text) => resolve(err || !text ? "" : text));
  });
}

function buildEpubAssetCandidates(epub, src, chapterHref) {
  const cleanSrc = decodeURIComponent(String(src).split(/[?#]/)[0]);
  const chapterDir = chapterHref ? path.posix.dirname(chapterHref) : "";
  const normalized = path.posix.normalize(path.posix.join(chapterDir, cleanSrc));
  const basename = path.posix.basename(cleanSrc);
  const candidates = [cleanSrc, normalized, basename];

  for (const [id, item] of Object.entries(epub.manifest || {})) {
    const href = item.href || "";
    if (
      href === cleanSrc ||
      href === normalized ||
      href.endsWith(`/${cleanSrc}`) ||
      href.endsWith(`/${basename}`) ||
      id === cleanSrc ||
      id === basename
    ) {
      candidates.push(id, href);
    }
  }

  return [...new Set(candidates.filter(Boolean))];
}

async function getEpubBinaryAsset(epub, candidates) {
  for (const candidate of candidates) {
    const image = await new Promise((resolve) => {
      epub.getImage(candidate, (err, data, mimeType) => {
        resolve(err || !data ? null : { buffer: Buffer.from(data), contentType: mimeType });
      });
    });
    if (image) return image;

    const file = await new Promise((resolve) => {
      epub.getFile(candidate, (err, data, mimeType) => {
        resolve(err || !data ? null : { buffer: Buffer.from(data), contentType: mimeType });
      });
    });
    if (file) return file;
  }

  return null;
}

async function uploadBookAsset({ bookId, sourceName, buffer, contentType }) {
  const supabase = getSupabase();
  const extension = path.extname(sourceName).toLowerCase() || extensionForContentType(contentType);
  const baseName = path
    .basename(sourceName, path.extname(sourceName))
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const digest = crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 12);
  const fileName = `${baseName || "image"}-${digest}${extension || ""}`;
  const storagePath = `books/${bookId || "unknown"}/assets/${fileName}`;

  const { error } = await supabase.storage.from(ASSET_STORAGE_BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  });

  if (error) throw new Error(`Asset upload failed: ${error.message}`);

  return supabase.storage.from(ASSET_STORAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

async function extractEpubCover(epub) {
  const coverId = epub.metadata?.cover;
  if (!coverId) return null;

  const cover = await getEpubBinaryAsset(epub, [coverId]);
  return cover?.buffer || null;
}

async function uploadOptimizedCover(bookId, coverBuffer) {
  const supabase = getSupabase();
  const image = await Jimp.read(coverBuffer);
  image.resize({ w: 300 });
  const optimizedCover = await image.getBuffer("image/jpeg", { quality: 80 });
  const coverPath = `covers/${bookId}.jpg`;

  const { error } = await supabase.storage.from(BOOK_STORAGE_BUCKET).upload(coverPath, optimizedCover, {
    contentType: "image/jpeg",
    upsert: true,
  });

  if (error) throw new Error(`Cover upload failed: ${error.message}`);
  return supabase.storage.from(BOOK_STORAGE_BUCKET).getPublicUrl(coverPath).data.publicUrl;
}

async function readPDFMetadata(buffer) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  return pdf.getMetadata().catch(() => null);
}

async function extractPDFCover(buffer) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toBuffer("image/jpeg");
}

function inferMarkdownTitle(markdown) {
  const heading = markdown.match(/^#{1,6}\s+(.+)$/m);
  return heading?.[1]?.trim() || null;
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function inferContentType(fileName, buffer) {
  const ext = path.extname(String(fileName).toLowerCase());
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (buffer?.subarray(0, 4).toString("hex") === "89504e47") return "image/png";
  if (buffer?.subarray(0, 3).toString("hex") === "ffd8ff") return "image/jpeg";
  return "application/octet-stream";
}

function extensionForContentType(contentType) {
  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/png") return ".png";
  if (contentType === "image/gif") return ".gif";
  if (contentType === "image/webp") return ".webp";
  return "";
}

function spawnBuffered(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: buildPythonEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve(stdout);
      reject(new Error(stderr || stdout || `${command} exited with code ${code}`));
    });
  });
}

async function spawnPythonBuffered(args) {
  const commands = getPythonCommands();
  let lastError;

  for (const command of commands) {
    try {
      return await spawnBuffered(command, args);
    } catch (err) {
      lastError = err;
      if (err.code !== "ENOENT") break;
    }
  }

  throw lastError;
}

function getPythonCommands() {
  if (process.env.PYTHON_BIN) return [process.env.PYTHON_BIN];
  return process.platform === "win32" ? ["python", "py"] : ["python3", "python"];
}

function buildPythonEnv() {
  const pythonPathParts = [PYTHON_VENDOR_PATH];
  if (process.env.PYTHONPATH) pythonPathParts.push(process.env.PYTHONPATH);

  return {
    ...process.env,
    PYTHONPATH: pythonPathParts.join(path.delimiter),
  };
}

async function verifyPythonBridge() {
  if (PDF_PIPELINE !== "python") return;

  let stdout;
  try {
    stdout = await spawnPythonBuffered([
      "-c",
      "import sys, fitz; print(sys.executable + ' PyMuPDF=' + getattr(fitz, 'VersionBind', 'unknown'))",
    ]);
  } catch (err) {
    throw new Error(
      [
        `Python bridge preflight failed. Tried: ${getPythonCommands().join(", ")}.`,
        "The worker requires Python plus PyMuPDF for PDF_PIPELINE=python.",
        "Install apps/worker/requirements.txt in the worker image and set PYTHON_BIN if needed.",
        `Original error: ${err.message}`,
      ].join(" "),
    );
  }

  console.log(`[Worker] Python PDF bridge ready: ${stdout.trim()}`);
}

function cleanupTempFile(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.warn(`[Worker] Failed to remove temp file ${filePath}:`, err.message);
  }
}

module.exports = {
  buildPageRows,
  chunkToStrictCharacterPages,
  processEPUB,
  epubHtmlToMarkdown,
  processPDF,
  processPDFFallback,
  processPDFWithPythonBridge,
  processPDFWithPdfJs,
  processPDFWithUnstructured,
  verifyPythonBridge,
};

if (require.main === module) {
  verifyPythonBridge()
    .then(() => {
      setTimeout(processQueue, 1000);
      console.log(`Worker booted. Listening for books... PDF_PIPELINE=${PDF_PIPELINE}`);
    })
    .catch((err) => {
      console.error("[Worker] Python PDF bridge is not available:", err.message);
      console.error(
        "[Worker] Install python3 and PyMuPDF, set PYTHON_BIN, or choose PDF_PIPELINE=unstructured/pdfjs.",
      );
      process.exit(1);
    });
}
