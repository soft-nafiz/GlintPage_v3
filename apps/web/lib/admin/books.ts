import { createHash } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BOOK_STORAGE_BUCKET =
  process.env.SUPABASE_BOOK_BUCKET ||
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ||
  "library";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "application/epub+zip", ""];
const ALLOWED_EXTENSIONS = [".pdf", ".epub"];
const LOOKUP_TIMEOUT_MS = 4500;
const QUICK_TIMEOUT_MS = 2500;
const GUTENBERG_ORIGIN = "https://www.gutenberg.org";
const STANDARD_EBOOKS_ORIGIN = "https://standardebooks.org";

type GoogleVolume = {
  id?: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    description?: string;
    categories?: string[];
    imageLinks?: Record<string, string | undefined>;
    publishedDate?: string;
    pageCount?: number;
  };
};

type GoogleBooksResponse = {
  items?: GoogleVolume[];
};

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  subject?: string[];
  first_publish_year?: number;
  cover_i?: number;
};

type OpenLibraryResponse = {
  docs?: OpenLibraryDoc[];
};

type OpenLibraryWork = {
  description?: string | { value?: string };
  subjects?: string[];
  covers?: number[];
};

type GutendexPerson = {
  name?: string;
};

type GutendexBook = {
  id: number;
  title?: string;
  subjects?: string[];
  authors?: GutendexPerson[];
  summaries?: string[];
  bookshelves?: string[];
  languages?: string[];
  copyright?: boolean | null;
  formats?: Record<string, string>;
  download_count?: number;
};

type GutendexResponse = {
  results?: GutendexBook[];
};

type InternetArchiveSearchResponse = {
  response?: {
    docs?: InternetArchiveSearchDoc[];
  };
};

type InternetArchiveSearchDoc = {
  identifier?: string;
  title?: string;
  creator?: string | string[];
  downloads?: number;
  licenseurl?: string;
  rights?: string;
  collection?: string | string[];
};

type InternetArchiveMetadata = {
  metadata?: Record<string, unknown>;
  files?: Array<{
    name?: string;
    format?: string;
    size?: string;
  }>;
};

type GutenbergPageMetadata = {
  title: string | null;
  author: string | null;
  description: string | null;
  tags: string[];
  coverPreviewUrl: string | null;
};

export type PublicSourceProvider =
  | "gutenberg"
  | "standard_ebooks"
  | "internet_archive";

export type AdminBookMetadata = {
  title: string;
  author: string | null;
  description: string | null;
  tags: string[];
  googleBooksId: string | null;
  coverPreviewUrl: string | null;
  coverSource?: string | null;
  publishedDate?: string | null;
  pageCount?: number | null;
};

export type PublicBookCandidate = {
  provider: PublicSourceProvider;
  externalId: string;
  id?: number;
  title: string;
  author: string | null;
  languages: string[];
  subjects: string[];
  bookshelves: string[];
  downloadCount: number;
  epubUrl: string | null;
  sourceUrl: string | null;
  coverPreviewUrl?: string | null;
  description?: string | null;
  licenseLabel?: string | null;
};

export type GutenbergCandidate = PublicBookCandidate;

export type AdminLookupResult = {
  jobId: string;
  status: AdminImportJobStatus;
  metadata: AdminBookMetadata;
  candidates: PublicBookCandidate[];
  metadataSources: string[];
};

export type AdminImportJobStatus =
  | "draft"
  | "metadata_found"
  | "source_found"
  | "manual_upload_required"
  | "approved"
  | "downloading"
  | "queued_for_processing"
  | "completed"
  | "failed";

export type AdminImportInput = {
  admin: User;
  jobId?: string | null;
  metadata: AdminBookMetadata;
  selectedCandidate?: PublicBookCandidate | null;
  gutenbergId?: number | null;
  file?: File | null;
};

function adminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function getAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.toLowerCase();
  if (!user || !email || !adminEmails().has(email)) return null;
  return user;
}

function cleanText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeSearchValue(value: string) {
  return cleanText(value)
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+-\s+Project Gutenberg.*$/i, "")
    .replace(/\s+\|\s+Project Gutenberg.*$/i, "")
    .replace(/\s+\(.*?Google Books.*?\)\s*$/i, "")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleWithoutAuthor(title: string, author?: string) {
  let cleanTitle = normalizeSearchValue(title);
  const cleanAuthor = normalizeSearchValue(author || "");

  if (cleanAuthor) {
    cleanTitle = cleanTitle
      .replace(new RegExp(`\\s+by\\s+${escapeRegExp(cleanAuthor)}\\s*$`, "i"), "")
      .replace(new RegExp(`\\s*[-:;]\\s*${escapeRegExp(cleanAuthor)}\\s*$`, "i"), "")
      .trim();
  }

  cleanTitle = cleanTitle
    .replace(/\s+by\s+[A-Z][\w'.-]+(?:\s+[A-Z][\w'.-]+){0,4}\s*$/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();

  return cleanTitle || normalizeSearchValue(title);
}

function significantWords(value: string) {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "by",
    "for",
    "in",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
  ]);

  return normalizeSearchValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1 && !stopWords.has(word));
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const clean = normalizeSearchValue(value || "");
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
  }

  return output;
}

function withTimeout(ms = LOOKUP_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    done: () => clearTimeout(timeout),
  };
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    );
}

function stripHtml(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function extractMetaContent(html: string, property: string) {
  const escaped = escapeRegExp(property);
  return (
    html.match(
      new RegExp(
        `<meta\\s+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`,
        "i",
      ),
    )?.[1] || null
  );
}

function tableValueByHeader(html: string, header: string) {
  const escaped = escapeRegExp(header);
  return (
    html.match(
      new RegExp(
        `<tr[^>]*>\\s*<th[^>]*>\\s*${escaped}\\s*<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>\\s*<\\/tr>`,
        "i",
      ),
    )?.[1] || null
  );
}

function tableValuesByHeader(html: string, header: string) {
  const escaped = escapeRegExp(header);
  return Array.from(
    html.matchAll(
      new RegExp(
        `<tr[^>]*>\\s*<th[^>]*>\\s*${escaped}\\s*<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>\\s*<\\/tr>`,
        "gi",
      ),
    ),
    (match) => stripHtml(match[1]),
  ).filter(Boolean);
}

function extractBookshelfTags(html: string) {
  return Array.from(
    html.matchAll(/class=["']similar-books-tag["'][^>]*>([\s\S]*?)<\/a>/gi),
    (match) => stripHtml(match[1]),
  ).filter(Boolean);
}

function absoluteUrl(origin: string, url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

function gutenbergEpubUrl(id: number) {
  return `${GUTENBERG_ORIGIN}/ebooks/${id}.epub3.images`;
}

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .flatMap((tag) => tag.split("/"))
        .map((tag) => cleanText(tag))
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

function hasSupportedExtension(fileName: string) {
  const lowerName = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

function getFormatFromFile(file: File) {
  const lowerName = file.name.toLowerCase();
  if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) return "pdf";
  if (file.type === "application/epub+zip" || lowerName.endsWith(".epub")) return "epub";
  return null;
}

function validateManualFile(file: File) {
  if (file.size <= 0) return "No file selected.";
  if (file.size > MAX_FILE_SIZE) return "File exceeds 50MB limit.";
  if (!ALLOWED_TYPES.includes(file.type) || !hasSupportedExtension(file.name)) {
    return "Only PDF and EPUB files are supported.";
  }
  return null;
}

function bestGoogleCoverUrl(imageLinks?: Record<string, string | undefined>) {
  const url =
    imageLinks?.extraLarge ||
    imageLinks?.large ||
    imageLinks?.medium ||
    imageLinks?.small ||
    imageLinks?.thumbnail ||
    imageLinks?.smallThumbnail ||
    null;
  return url ? url.replace(/^http:\/\//, "https://") : null;
}

function openLibraryCoverUrl(coverId: number | undefined | null) {
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
}

function emptyMetadata(title: string, author?: string) {
  return {
    title: titleWithoutAuthor(title, author),
    author: cleanText(author) || null,
    description: null,
    tags: [],
    googleBooksId: null,
    coverPreviewUrl: null,
    coverSource: null,
    publishedDate: null,
    pageCount: null,
  } satisfies AdminBookMetadata;
}

function toMetadata(volume: GoogleVolume | undefined, title: string, author?: string) {
  const info = volume?.volumeInfo;
  const fallbackAuthor = cleanText(author);
  const googleAuthor = info?.authors?.length ? info.authors.join(", ") : fallbackAuthor;
  const bestTitle = titleWithoutAuthor(cleanText(info?.title) || title, googleAuthor);
  const coverPreviewUrl = bestGoogleCoverUrl(info?.imageLinks);
  return {
    title: bestTitle,
    author: googleAuthor || null,
    description: cleanText(info?.description) || null,
    tags: normalizeTags(info?.categories || []),
    googleBooksId: volume?.id || null,
    coverPreviewUrl,
    coverSource: coverPreviewUrl ? "google_books" : null,
    publishedDate: info?.publishedDate || null,
    pageCount: info?.pageCount || null,
  } satisfies AdminBookMetadata;
}

function openLibraryDescription(work: OpenLibraryWork | null) {
  const description = work?.description;
  if (!description) return null;
  if (typeof description === "string") return cleanText(description);
  return cleanText(description.value);
}

function toOpenLibraryMetadata(
  doc: OpenLibraryDoc,
  work: OpenLibraryWork | null,
  title: string,
  author?: string,
) {
  const openAuthor = doc.author_name?.length
    ? doc.author_name.slice(0, 3).join(", ")
    : cleanText(author) || null;
  const coverId = doc.cover_i || work?.covers?.[0] || null;
  const coverPreviewUrl = openLibraryCoverUrl(coverId);

  return {
    title: titleWithoutAuthor(cleanText(doc.title) || title, openAuthor || undefined),
    author: openAuthor,
    description: openLibraryDescription(work),
    tags: normalizeTags([...(work?.subjects || []), ...(doc.subject || [])].slice(0, 18)),
    googleBooksId: null,
    coverPreviewUrl,
    coverSource: coverPreviewUrl ? "open_library" : null,
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : null,
    pageCount: null,
  } satisfies AdminBookMetadata;
}

function getEpubUrl(book: GutendexBook) {
  const formats = book.formats || {};
  const entries = Object.entries(formats);
  return (
    entries.find(([mime]) => mime === "application/epub+zip")?.[1] ||
    entries.find(([mime]) => mime.startsWith("application/epub"))?.[1] ||
    entries.find(([, url]) => /\.epub($|\?)/i.test(url))?.[1] ||
    null
  );
}

function toGutenbergCandidate(book: GutendexBook): PublicBookCandidate {
  return {
    provider: "gutenberg",
    externalId: String(book.id),
    id: book.id,
    title: cleanText(book.title) || `Project Gutenberg #${book.id}`,
    author:
      book.authors?.map((author) => cleanText(author.name)).filter(Boolean).join(", ") ||
      null,
    languages: book.languages || [],
    subjects: (book.subjects || []).slice(0, 8),
    bookshelves: (book.bookshelves || []).slice(0, 8),
    downloadCount: book.download_count || 0,
    epubUrl: getEpubUrl(book),
    sourceUrl: `${GUTENBERG_ORIGIN}/ebooks/${book.id}`,
    description: cleanText(book.summaries?.[0]) || null,
    licenseLabel: "Project Gutenberg public domain",
  };
}

function mergeMetadata(
  base: AdminBookMetadata,
  fallback: Partial<{
    title: string | null;
    author: string | null;
    description: string | null;
    tags: string[];
    coverPreviewUrl: string | null;
    coverSource: string | null;
    publishedDate: string | null;
    pageCount: number | null;
  }>,
) {
  const coverPreviewUrl = base.coverPreviewUrl || fallback.coverPreviewUrl || null;
  return {
    ...base,
    title: base.title || fallback.title || "",
    author: base.author || fallback.author || null,
    description: base.description || fallback.description || null,
    tags: normalizeTags(base.tags.length ? base.tags : fallback.tags || []),
    coverPreviewUrl,
    coverSource: base.coverSource || fallback.coverSource || (coverPreviewUrl ? "metadata" : null),
    publishedDate: base.publishedDate || fallback.publishedDate || null,
    pageCount: base.pageCount || fallback.pageCount || null,
  } satisfies AdminBookMetadata;
}

export async function lookupAdminBook(admin: User, title: string, author?: string) {
  const cleanTitle = titleWithoutAuthor(title, author);
  const cleanAuthor = normalizeSearchValue(author || "");
  if (!cleanTitle) throw new Error("Enter a book title.");

  const [
    googleResult,
    openLibraryResult,
    initialGutenbergCandidates,
    standardEbooksCandidates,
    internetArchiveCandidates,
  ] = await Promise.all([
    fetchBestGoogleBooks(cleanTitle, cleanAuthor),
    fetchOpenLibraryMetadata(cleanTitle, cleanAuthor),
    fetchGutenbergSearch(cleanTitle, cleanAuthor),
    fetchStandardEbooksSearch(cleanTitle, cleanAuthor),
    fetchInternetArchiveSearch(cleanTitle, cleanAuthor),
  ]);

  const metadataSources: string[] = [];
  let metadata: AdminBookMetadata = emptyMetadata(cleanTitle, cleanAuthor);
  if (googleResult) {
    metadata = toMetadata(googleResult.items?.[0], cleanTitle, cleanAuthor);
    metadataSources.push("google_books");
  }

  if (openLibraryResult) {
    metadata = mergeMetadata(metadata, openLibraryResult);
    metadataSources.push("open_library");
  }

  const needsMetadataSearch =
    initialGutenbergCandidates.length === 0 ||
    !initialGutenbergCandidates.some((candidate) => candidate.epubUrl);
  const metadataGutenbergCandidates = needsMetadataSearch
    ? await fetchGutenbergHtmlSearch(metadata.title, metadata.author || cleanAuthor)
    : [];
  const candidates = mergePublicCandidates([
    ...initialGutenbergCandidates,
    ...metadataGutenbergCandidates,
    ...standardEbooksCandidates,
    ...internetArchiveCandidates,
  ]);
  const bestCandidateWithMetadata = candidates.find(
    (candidate) => candidate.description || candidate.coverPreviewUrl || candidate.subjects.length,
  );

  if (bestCandidateWithMetadata) {
    metadata = mergeMetadata(metadata, {
      title: bestCandidateWithMetadata.title,
      author: bestCandidateWithMetadata.author,
      description: bestCandidateWithMetadata.description || null,
      tags: [
        ...bestCandidateWithMetadata.bookshelves,
        ...bestCandidateWithMetadata.subjects,
      ],
      coverPreviewUrl: bestCandidateWithMetadata.coverPreviewUrl || null,
      coverSource: bestCandidateWithMetadata.provider,
    });
    metadataSources.push(bestCandidateWithMetadata.provider);
  }

  const bestGutenbergCandidate = candidates.find(
    (candidate) => candidate.provider === "gutenberg" && candidate.epubUrl,
  );

  if (
    bestGutenbergCandidate?.id &&
    (!metadata.author ||
      !metadata.description ||
      metadata.tags.length === 0 ||
      !metadata.coverPreviewUrl)
  ) {
    const gutenbergMetadata = await fetchGutenbergPageMetadata(bestGutenbergCandidate.id);
    metadata = mergeMetadata(metadata, gutenbergMetadata);
    if (
      gutenbergMetadata.author ||
      gutenbergMetadata.coverPreviewUrl ||
      gutenbergMetadata.tags.length
    ) {
      metadataSources.push("project_gutenberg");
    }
  }

  const status: AdminImportJobStatus = candidates.some((candidate) => candidate.epubUrl)
    ? "source_found"
    : "manual_upload_required";
  const { data: job, error: jobError } = await supabaseAdmin
    .from("admin_book_import_jobs")
    .insert({
      admin_id: admin.id,
      query_title: cleanTitle,
      query_author: cleanAuthor || null,
      status,
      metadata,
      candidates,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (jobError || !job) {
    throw new Error(jobError?.message || "Failed to create import job.");
  }

  return {
    jobId: job.id,
    status,
    metadata,
    candidates,
    metadataSources: Array.from(new Set(metadataSources)),
  } satisfies AdminLookupResult;
}

function buildGoogleBooksUrl(title: string, author?: string) {
  const googleQuery = [`intitle:${title}`];
  if (author) googleQuery.push(`inauthor:${author}`);

  const googleUrl = new URL("https://www.googleapis.com/books/v1/volumes");
  googleUrl.searchParams.set("q", googleQuery.join(" "));
  googleUrl.searchParams.set("printType", "books");
  googleUrl.searchParams.set("projection", "full");
  googleUrl.searchParams.set("maxResults", "5");
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    googleUrl.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  }
  return googleUrl;
}

async function fetchBestGoogleBooks(title: string, author?: string) {
  const withAuthor = author
    ? await fetchGoogleBooks(buildGoogleBooksUrl(title, author))
    : null;
  if (withAuthor?.items?.length) return withAuthor;
  return fetchGoogleBooks(buildGoogleBooksUrl(title));
}

async function fetchGoogleBooks(url: URL) {
  const timeout = withTimeout(QUICK_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      next: { revalidate: 60 * 60 * 24 },
      signal: timeout.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as GoogleBooksResponse;
  } catch (error) {
    if (!isAbortError(error)) {
      console.warn(
        "[admin-books] Google Books lookup failed:",
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  } finally {
    timeout.done();
  }
}

async function fetchOpenLibraryMetadata(title: string, author?: string) {
  const withAuthor = author ? await fetchOpenLibrarySearch(title, author) : null;
  const titleOnly = withAuthor ? null : await fetchOpenLibrarySearch(title);
  const docs = withAuthor?.docs?.length ? withAuthor.docs : titleOnly?.docs || [];
  const bestDoc = chooseOpenLibraryDoc(docs, title, author);
  if (!bestDoc) return null;

  const work = await fetchOpenLibraryWork(bestDoc.key);
  return toOpenLibraryMetadata(bestDoc, work, title, author);
}

async function fetchOpenLibrarySearch(title: string, author?: string) {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("title", title);
  if (author) url.searchParams.set("author", author);
  url.searchParams.set("limit", "5");
  url.searchParams.set(
    "fields",
    "key,title,author_name,subject,first_publish_year,cover_i",
  );

  const timeout = withTimeout(QUICK_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      next: { revalidate: 60 * 60 * 24 },
      signal: timeout.signal,
      headers: { "User-Agent": "GlintpageAdminImporter/1.0" },
    });
    if (!response.ok) return null;
    return (await response.json()) as OpenLibraryResponse;
  } catch (error) {
    if (isAbortError(error)) return null;
    console.warn(
      "[admin-books] Open Library lookup failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  } finally {
    timeout.done();
  }
}

async function fetchOpenLibraryWork(key?: string) {
  if (!key?.startsWith("/works/")) return null;
  const timeout = withTimeout(QUICK_TIMEOUT_MS);
  try {
    const response = await fetch(`https://openlibrary.org${key}.json`, {
      next: { revalidate: 60 * 60 * 24 },
      signal: timeout.signal,
      headers: { "User-Agent": "GlintpageAdminImporter/1.0" },
    });
    if (!response.ok) return null;
    return (await response.json()) as OpenLibraryWork;
  } catch (error) {
    if (!isAbortError(error)) {
      console.warn(
        "[admin-books] Open Library work lookup failed:",
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  } finally {
    timeout.done();
  }
}

function chooseOpenLibraryDoc(
  docs: OpenLibraryDoc[],
  title: string,
  author?: string,
) {
  const titleWords = new Set(significantWords(title));
  const authorWords = new Set(significantWords(author || ""));

  return docs
    .map((doc) => {
      const docTitleWords = new Set(significantWords(doc.title || ""));
      const docAuthorWords = new Set(significantWords(doc.author_name?.join(" ") || ""));
      const titleHits = Array.from(titleWords).filter((word) => docTitleWords.has(word)).length;
      const authorHits = Array.from(authorWords).filter((word) => docAuthorWords.has(word)).length;
      return {
        doc,
        score:
          titleHits * 12 +
          authorHits * 8 +
          (doc.cover_i ? 8 : 0) +
          (doc.subject?.length ? 4 : 0),
      };
    })
    .sort((a, b) => b.score - a.score)[0]?.doc;
}

async function fetchGutenbergSearch(title: string, author?: string) {
  const cleanTitle = titleWithoutAuthor(title, author);
  const cleanAuthor = normalizeSearchValue(author || "");
  const titleWords = significantWords(cleanTitle);
  const compactTitle = titleWords.slice(0, 5).join(" ");
  const leadingTitle = titleWords.slice(0, 3).join(" ");
  const cleanTitleBeforeSubtitle = cleanTitle.split(/[:;]/)[0]?.trim();
  const queries = uniqueStrings([
    [cleanTitle, cleanAuthor].filter(Boolean).join(" "),
    cleanTitle,
    [cleanTitleBeforeSubtitle, cleanAuthor].filter(Boolean).join(" "),
    compactTitle,
    leadingTitle,
  ]).slice(0, 4);

  const results = await Promise.all(queries.map(fetchGutenbergQuery));
  return mergePublicCandidates(results.flat());
}

async function fetchGutenbergQuery(search: string) {
  const url = new URL("https://gutendex.com/books");
  url.searchParams.set("search", search);
  url.searchParams.set("copyright", "false");

  const timeout = withTimeout(QUICK_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      next: { revalidate: 60 * 60 * 24 },
      signal: timeout.signal,
    });
    if (!response.ok) return [];

    const data = (await response.json()) as GutendexResponse;
    return (data.results || [])
      .filter((book) => book.copyright === false)
      .map(toGutenbergCandidate);
  } catch (error) {
    if (isAbortError(error)) return [];
    console.warn(
      "[admin-books] Gutenberg lookup failed:",
      error instanceof Error ? error.message : error,
    );
    return [];
  } finally {
    timeout.done();
  }
}

async function fetchGutenbergHtmlSearch(title: string, author?: string) {
  const cleanTitle = titleWithoutAuthor(title, author);
  const cleanAuthor = normalizeSearchValue(author || "");
  const queries = uniqueStrings([
    cleanTitle,
    [cleanTitle, cleanAuthor].filter(Boolean).join(" "),
    significantWords(cleanTitle).slice(0, 5).join(" "),
  ]).slice(0, 3);

  const results = await Promise.all(queries.map(fetchGutenbergHtmlQuery));
  return mergePublicCandidates(results.flat());
}

async function fetchGutenbergHtmlQuery(search: string) {
  const url = new URL("/ebooks/search/", GUTENBERG_ORIGIN);
  url.searchParams.set("query", search);

  const timeout = withTimeout(QUICK_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      next: { revalidate: 60 * 60 * 24 },
      signal: timeout.signal,
      headers: { "User-Agent": "GlintpageAdminImporter/1.0" },
    });
    if (!response.ok) return [];

    const html = await response.text();
    const candidates: PublicBookCandidate[] = [];
    const blocks = html.matchAll(/<li class="booklink">([\s\S]*?)<\/li>/g);

    for (const match of blocks) {
      const block = match[1];
      const id = Number(block.match(/href="\/ebooks\/(\d+)"/)?.[1]);
      if (!Number.isFinite(id) || id <= 0) continue;

      const titleMatch = block.match(/<span class="title">([\s\S]*?)<\/span>/);
      const authorMatch = block.match(/<span class="subtitle">([\s\S]*?)<\/span>/);
      const downloadsMatch = block.match(/<span class="extra">([\d,]+)/);

      candidates.push({
        provider: "gutenberg",
        externalId: String(id),
        id,
        title: stripHtml(titleMatch?.[1] || `Project Gutenberg #${id}`),
        author: stripHtml(authorMatch?.[1] || "") || null,
        languages: [],
        subjects: [],
        bookshelves: [],
        downloadCount: Number((downloadsMatch?.[1] || "0").replace(/,/g, "")),
        epubUrl: gutenbergEpubUrl(id),
        sourceUrl: `${GUTENBERG_ORIGIN}/ebooks/${id}`,
        licenseLabel: "Project Gutenberg public domain",
      });
    }

    return candidates;
  } catch (error) {
    if (isAbortError(error)) return [];
    console.warn(
      "[admin-books] Project Gutenberg HTML lookup failed:",
      error instanceof Error ? error.message : error,
    );
    return [];
  } finally {
    timeout.done();
  }
}

async function fetchStandardEbooksSearch(title: string, author?: string) {
  const query = [titleWithoutAuthor(title, author), normalizeSearchValue(author || "")]
    .filter(Boolean)
    .join(" ");
  const url = new URL("/ebooks", STANDARD_EBOOKS_ORIGIN);
  url.searchParams.set("query", query);

  const timeout = withTimeout(QUICK_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      next: { revalidate: 60 * 60 * 24 },
      signal: timeout.signal,
      headers: { "User-Agent": "GlintpageAdminImporter/1.0" },
    });
    if (!response.ok) return [];

    const html = await response.text();
    const hrefs = Array.from(
      html.matchAll(/href=["'](\/ebooks\/[a-z0-9-]+\/[a-z0-9-]+(?:\/[a-z0-9-]+)?)["']/gi),
      (match) => match[1],
    )
      .filter((href) => !href.includes("/downloads/"))
      .slice(0, 5);

    const uniqueHrefs = Array.from(new Set(hrefs));
    const details = await Promise.all(uniqueHrefs.map(fetchStandardEbooksDetail));
    return details.filter(Boolean) as PublicBookCandidate[];
  } catch (error) {
    if (!isAbortError(error)) {
      console.warn(
        "[admin-books] Standard Ebooks lookup failed:",
        error instanceof Error ? error.message : error,
      );
    }
    return [];
  } finally {
    timeout.done();
  }
}

async function fetchStandardEbooksDetail(path: string) {
  const sourceUrl = absoluteUrl(STANDARD_EBOOKS_ORIGIN, path);
  const timeout = withTimeout(QUICK_TIMEOUT_MS);
  try {
    const response = await fetch(sourceUrl, {
      next: { revalidate: 60 * 60 * 24 },
      signal: timeout.signal,
      headers: { "User-Agent": "GlintpageAdminImporter/1.0" },
    });
    if (!response.ok) return null;

    const html = await response.text();
    const titleText =
      stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "") ||
      stripHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
    const titleAuthor = titleText.match(/,\s+by\s+(.+?)\s+-\s+/i)?.[1]?.trim();
    const authorText =
      stripHtml(html.match(/rel=["']author["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] || "") ||
      stripHtml(html.match(/<p[^>]+class=["'][^"']*author[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] || "") ||
      titleAuthor ||
      "";
    const epubHref =
      html.match(/href=["']([^"']+\/downloads\/[^"']+\.epub)["']/i)?.[1] || null;
    const description =
      decodeHtmlEntities(extractMetaContent(html, "og:description") || "") ||
      decodeHtmlEntities(extractMetaContent(html, "description") || "");
    const coverPreviewUrl = extractMetaContent(html, "og:image");
    const subjects = normalizeTags(
      Array.from(
        html.matchAll(/\/ebooks\?tags=[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi),
        (match) => stripHtml(match[1]),
      ),
    );

    return {
      provider: "standard_ebooks",
      externalId: path.replace(/^\/ebooks\//, ""),
      title: titleWithoutAuthor(
        titleText.replace(/\s+-\s+Free ebook download.*$/i, ""),
        authorText,
      ),
      author: authorText || null,
      languages: ["en"],
      subjects,
      bookshelves: ["Standard Ebooks"],
      downloadCount: 0,
      epubUrl: epubHref ? absoluteUrl(STANDARD_EBOOKS_ORIGIN, epubHref) : null,
      sourceUrl,
      coverPreviewUrl: coverPreviewUrl ? absoluteUrl(STANDARD_EBOOKS_ORIGIN, coverPreviewUrl) : null,
      description: cleanText(description) || null,
      licenseLabel: "Standard Ebooks public domain / CC0",
    } satisfies PublicBookCandidate;
  } catch (error) {
    if (!isAbortError(error)) {
      console.warn(
        "[admin-books] Standard Ebooks detail failed:",
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  } finally {
    timeout.done();
  }
}

async function fetchInternetArchiveSearch(title: string, author?: string) {
  const titleQuery = titleWithoutAuthor(title, author);
  const url = new URL("https://archive.org/advancedsearch.php");
  url.searchParams.set("q", `title:("${titleQuery}") AND mediatype:texts`);
  for (const field of [
    "identifier",
    "title",
    "creator",
    "downloads",
    "licenseurl",
    "rights",
    "collection",
  ]) {
    url.searchParams.append("fl[]", field);
  }
  url.searchParams.set("rows", "5");
  url.searchParams.set("page", "1");
  url.searchParams.set("output", "json");

  const timeout = withTimeout(QUICK_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      next: { revalidate: 60 * 60 * 24 },
      signal: timeout.signal,
      headers: { "User-Agent": "GlintpageAdminImporter/1.0" },
    });
    if (!response.ok) return [];

    const data = (await response.json()) as InternetArchiveSearchResponse;
    const docs = data.response?.docs || [];
    const details = await Promise.all(docs.slice(0, 3).map(fetchInternetArchiveDetail));
    return details.filter(Boolean) as PublicBookCandidate[];
  } catch (error) {
    if (!isAbortError(error)) {
      console.warn(
        "[admin-books] Internet Archive lookup failed:",
        error instanceof Error ? error.message : error,
      );
    }
    return [];
  } finally {
    timeout.done();
  }
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  if (Array.isArray(value)) return cleanText(value.join(", "));
  return cleanText(value);
}

function metadataList(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  return cleanText(value)
    .split(";")
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function isPublicDomainArchiveItem(metadata: Record<string, unknown> | undefined) {
  const licenseUrl = metadataString(metadata, "licenseurl").toLowerCase();
  const rights = metadataString(metadata, "rights").toLowerCase();
  const collection = metadataList(metadata, "collection").join(" ").toLowerCase();
  return (
    licenseUrl.includes("publicdomain") ||
    licenseUrl.includes("creativecommons.org/publicdomain/zero") ||
    rights.includes("public domain") ||
    collection.includes("gutenberg")
  );
}

async function fetchInternetArchiveDetail(doc: InternetArchiveSearchDoc) {
  const identifier = cleanText(doc.identifier);
  if (!identifier) return null;

  const timeout = withTimeout(QUICK_TIMEOUT_MS);
  try {
    const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`, {
      next: { revalidate: 60 * 60 * 24 },
      signal: timeout.signal,
      headers: { "User-Agent": "GlintpageAdminImporter/1.0" },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as InternetArchiveMetadata;
    if (!isPublicDomainArchiveItem(data.metadata)) return null;

    const epubFile = data.files?.find((file) => {
      const name = file.name || "";
      const format = file.format || "";
      return /\.epub$/i.test(name) || /epub/i.test(format);
    });
    if (!epubFile?.name) return null;

    const sourceUrl = `https://archive.org/details/${identifier}`;
    const epubUrl = `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(epubFile.name)}`;
    const coverFile = data.files?.find((file) => /_itemimage\.(jpg|jpeg|png|webp)$/i.test(file.name || ""));
    const creator = metadataString(data.metadata, "creator") || cleanText(doc.creator);

    return {
      provider: "internet_archive",
      externalId: identifier,
      title: metadataString(data.metadata, "title") || cleanText(doc.title) || identifier,
      author: creator || null,
      languages: metadataList(data.metadata, "language"),
      subjects: normalizeTags(metadataList(data.metadata, "subject")),
      bookshelves: ["Internet Archive"],
      downloadCount: Number(doc.downloads || 0),
      epubUrl,
      sourceUrl,
      coverPreviewUrl: coverFile?.name
        ? `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(coverFile.name)}`
        : null,
      description: stripHtml(metadataString(data.metadata, "description")),
      licenseLabel: "Internet Archive public-domain item",
    } satisfies PublicBookCandidate;
  } catch (error) {
    if (!isAbortError(error)) {
      console.warn(
        "[admin-books] Internet Archive detail failed:",
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  } finally {
    timeout.done();
  }
}

function mergePublicCandidates(candidates: PublicBookCandidate[]) {
  const byKey = new Map<string, PublicBookCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.provider}:${candidate.externalId}`;
    const existing = byKey.get(key);
    if (
      !existing ||
      (!existing.epubUrl && candidate.epubUrl) ||
      (!existing.description && candidate.description)
    ) {
      byKey.set(key, candidate);
    }
  }

  const providerRank: Record<PublicSourceProvider, number> = {
    standard_ebooks: 3,
    gutenberg: 2,
    internet_archive: 1,
  };

  return Array.from(byKey.values())
    .sort(
      (a, b) =>
        Number(Boolean(b.epubUrl)) - Number(Boolean(a.epubUrl)) ||
        providerRank[b.provider] - providerRank[a.provider] ||
        b.downloadCount - a.downloadCount,
    )
    .slice(0, 10);
}

async function fetchGutenbergPageMetadata(id: number): Promise<GutenbergPageMetadata> {
  const timeout = withTimeout(QUICK_TIMEOUT_MS);
  try {
    const response = await fetch(`${GUTENBERG_ORIGIN}/ebooks/${id}`, {
      next: { revalidate: 60 * 60 * 24 },
      signal: timeout.signal,
      headers: { "User-Agent": "GlintpageAdminImporter/1.0" },
    });
    if (!response.ok) {
      return {
        title: null,
        author: null,
        description: null,
        tags: [],
        coverPreviewUrl: null,
      };
    }

    const html = await response.text();
    const rawTitle =
      stripHtml(tableValueByHeader(html, "Title") || "") ||
      stripHtml(html.match(/<h1[^>]*id=["']book_title["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
    const rawAuthor = stripHtml(tableValueByHeader(html, "Author") || "");
    const author = rawAuthor.replace(/,\s*\d{4}.*$/, "").trim() || null;
    const tags = normalizeTags([
      ...tableValuesByHeader(html, "Subject"),
      ...extractBookshelfTags(html),
    ]);
    const metaDescription =
      decodeHtmlEntities(extractMetaContent(html, "og:description") || "") ||
      decodeHtmlEntities(extractMetaContent(html, "description") || "");
    const coverPreviewUrl = extractMetaContent(html, "og:image");

    return {
      title: titleWithoutAuthor(rawTitle, author || undefined) || null,
      author,
      description:
        metaDescription && !/^free ebook digitized/i.test(metaDescription)
          ? metaDescription
          : tags.length
            ? `A public-domain Project Gutenberg text about ${tags
                .slice(0, 3)
                .join(", ")}.`
            : null,
      tags,
      coverPreviewUrl,
    };
  } catch (error) {
    if (!isAbortError(error)) {
      console.warn(
        "[admin-books] Gutenberg metadata fallback failed:",
        error instanceof Error ? error.message : error,
      );
    }
    return {
      title: null,
      author: null,
      description: null,
      tags: [],
      coverPreviewUrl: null,
    };
  } finally {
    timeout.done();
  }
}

async function fetchGutenbergBook(id: number) {
  const timeout = withTimeout(QUICK_TIMEOUT_MS);
  try {
    const response = await fetch(`https://gutendex.com/books/${id}`, {
      cache: "no-store",
      signal: timeout.signal,
    });
    if (!response.ok) throw new Error("Project Gutenberg book was not found.");

    const book = (await response.json()) as GutendexBook;
    const candidate = toGutenbergCandidate(book);
    if (book.copyright !== false || !candidate.epubUrl) {
      throw new Error("No safe Gutenberg EPUB found for this title.");
    }
    return candidate;
  } catch (error) {
    if (!isAbortError(error)) {
      console.warn(
        "[admin-books] Gutendex book detail failed:",
        error instanceof Error ? error.message : error,
      );
    }
    return fetchGutenbergBookFromHtml(id);
  } finally {
    timeout.done();
  }
}

async function fetchGutenbergBookFromHtml(id: number) {
  const response = await fetch(`${GUTENBERG_ORIGIN}/ebooks/${id}`, {
    cache: "no-store",
    headers: { "User-Agent": "GlintpageAdminImporter/1.0" },
  });
  if (!response.ok) throw new Error("Project Gutenberg book was not found.");

  const html = await response.text();
  const title = stripHtml(html.match(/<h1[^>]*id="book_title"[^>]*>([\s\S]*?)<\/h1>/)?.[1] || "");
  const author = title.match(/\s+by\s+(.+)$/i)?.[1]?.trim() || null;
  const epubHref =
    html.match(/href="([^"]+\.epub3\.images[^"]*)"/)?.[1] ||
    html.match(/href="([^"]+\.epub\.images[^"]*)"/)?.[1] ||
    html.match(/href="([^"]+\.epub\.noimages[^"]*)"/)?.[1] ||
    `/ebooks/${id}.epub3.images`;

  return {
    provider: "gutenberg",
    externalId: String(id),
    id,
    title: titleWithoutAuthor(title || `Project Gutenberg #${id}`, author || undefined),
    author,
    languages: [],
    subjects: [],
    bookshelves: [],
    downloadCount: 0,
    epubUrl: absoluteUrl(GUTENBERG_ORIGIN, epubHref),
    sourceUrl: `${GUTENBERG_ORIGIN}/ebooks/${id}`,
    licenseLabel: "Project Gutenberg public domain",
  } satisfies PublicBookCandidate;
}

async function resolvePublicCandidate(candidate: PublicBookCandidate) {
  if (candidate.provider === "gutenberg") {
    return fetchGutenbergBook(Number(candidate.externalId || candidate.id));
  }

  if (candidate.provider === "standard_ebooks") {
    const resolved = await fetchStandardEbooksDetail(`/ebooks/${candidate.externalId}`);
    if (!resolved?.epubUrl) throw new Error("No Standard Ebooks EPUB found.");
    return resolved;
  }

  if (candidate.provider === "internet_archive") {
    const resolved = await fetchInternetArchiveDetail({ identifier: candidate.externalId });
    if (!resolved?.epubUrl) throw new Error("No public-domain Internet Archive EPUB found.");
    return resolved;
  }

  throw new Error("Unsupported public book source.");
}

async function fetchBuffer(url: string, errorMessage: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(errorMessage);
  return Buffer.from(await response.arrayBuffer());
}

function extensionForContentType(contentType: string | null) {
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  return "jpg";
}

async function uploadMetadataCover(coverUrl: string | null, coverSource?: string | null) {
  if (!coverUrl) return { publicUrl: null, source: null, storagePath: null };

  const response = await fetch(coverUrl, { cache: "no-store" });
  if (!response.ok) return { publicUrl: null, source: null, storagePath: null };

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  const hash = createHash("sha256").update(buffer).digest("hex");
  const ext = extensionForContentType(contentType);
  const coverPath = `covers/metadata/${hash}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(BOOK_STORAGE_BUCKET)
    .upload(coverPath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`Cover upload failed: ${error.message}`);
  return {
    publicUrl: supabaseAdmin.storage.from(BOOK_STORAGE_BUCKET).getPublicUrl(coverPath).data.publicUrl,
    source: coverSource || "metadata",
    storagePath: coverPath,
  };
}

async function uploadBookBuffer({
  buffer,
  format,
  contentType,
  fileHash,
}: {
  buffer: Buffer;
  format: "pdf" | "epub";
  contentType: string;
  fileHash: string;
}) {
  const filePath = `public/${fileHash}.${format}`;
  const { error } = await supabaseAdmin.storage
    .from(BOOK_STORAGE_BUCKET)
    .upload(filePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`Book upload failed: ${error.message}`);
  return filePath;
}

async function updateImportJob(
  jobId: string | null | undefined,
  patch: Record<string, unknown>,
) {
  if (!jobId) return;
  const { error } = await supabaseAdmin
    .from("admin_book_import_jobs")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    console.warn("[admin-books] import job update failed:", error.message);
  }
}

export async function createAdminPublicBook(input: AdminImportInput) {
  const metadata = {
    ...input.metadata,
    title: cleanText(input.metadata.title),
    author: cleanText(input.metadata.author) || null,
    description: cleanText(input.metadata.description) || null,
    tags: normalizeTags(input.metadata.tags || []),
    googleBooksId: cleanText(input.metadata.googleBooksId) || null,
    coverPreviewUrl: cleanText(input.metadata.coverPreviewUrl) || null,
    coverSource: cleanText(input.metadata.coverSource) || null,
  };

  if (!metadata.title) throw new Error("Book title is required.");

  let buffer: Buffer;
  let format: "pdf" | "epub";
  let contentType: string;
  let sourceProvider: string;
  let sourceUrl: string | null;
  let gutenbergId: number | null = null;
  let selectedCandidate: PublicBookCandidate | null = input.selectedCandidate || null;

  if (!selectedCandidate && input.gutenbergId) {
    selectedCandidate = {
      provider: "gutenberg",
      externalId: String(input.gutenbergId),
      id: input.gutenbergId,
      title: metadata.title,
      author: metadata.author,
      languages: [],
      subjects: [],
      bookshelves: [],
      downloadCount: 0,
      epubUrl: null,
      sourceUrl: `${GUTENBERG_ORIGIN}/ebooks/${input.gutenbergId}`,
    };
  }

  await updateImportJob(input.jobId, {
    status: "approved",
    metadata,
    error_message: null,
  });

  try {
    if (selectedCandidate) {
      if (selectedCandidate.provider === "gutenberg") {
        const existingByGutenberg = await supabaseAdmin
          .from("books")
          .select("id, title, status")
          .eq("is_public", true)
          .eq("gutenberg_id", Number(selectedCandidate.externalId))
          .maybeSingle();

        if (existingByGutenberg.data) {
          await updateImportJob(input.jobId, {
            status: "completed",
            book_id: existingByGutenberg.data.id,
          });
          return { bookId: existingByGutenberg.data.id, duplicate: true };
        }
      }

      const candidate = await resolvePublicCandidate(selectedCandidate);
      if (!candidate.epubUrl) throw new Error("Selected source does not provide an EPUB.");

      if (candidate.sourceUrl) {
        const existingBySource = await supabaseAdmin
          .from("books")
          .select("id, title, status")
          .eq("is_public", true)
          .eq("source_provider", candidate.provider)
          .eq("source_url", candidate.sourceUrl)
          .maybeSingle();

        if (existingBySource.data) {
          await updateImportJob(input.jobId, {
            status: "completed",
            book_id: existingBySource.data.id,
          });
          return { bookId: existingBySource.data.id, duplicate: true };
        }
      }

      await updateImportJob(input.jobId, {
        status: "downloading",
        selected_candidate: candidate,
        source_provider: candidate.provider,
        source_url: candidate.sourceUrl,
      });
      buffer = await fetchBuffer(candidate.epubUrl, "Could not download public EPUB source.");
      format = "epub";
      contentType = "application/epub+zip";
      sourceProvider = candidate.provider;
      sourceUrl = candidate.sourceUrl;
      gutenbergId = candidate.provider === "gutenberg" ? Number(candidate.externalId) : null;
    } else if (input.file) {
      const validationError = validateManualFile(input.file);
      if (validationError) throw new Error(validationError);

      format = getFormatFromFile(input.file) as "pdf" | "epub";
      contentType = input.file.type || (format === "pdf" ? "application/pdf" : "application/epub+zip");
      buffer = Buffer.from(await input.file.arrayBuffer());
      sourceProvider = "admin_upload";
      sourceUrl = null;
      await updateImportJob(input.jobId, {
        status: "downloading",
        selected_candidate: {
          provider: "admin_upload",
          fileName: input.file.name,
        },
        source_provider: sourceProvider,
        source_url: null,
      });
    } else {
      throw new Error("Choose a verified public source or upload a PDF/EPUB file.");
    }

    const fileHash = createHash("sha256").update(buffer).digest("hex");
    const existingByHash = await supabaseAdmin
      .from("books")
      .select("id, title, status")
      .eq("is_public", true)
      .eq("file_hash", fileHash)
      .maybeSingle();

    if (existingByHash.data) {
      await updateImportJob(input.jobId, {
        status: "completed",
        book_id: existingByHash.data.id,
      });
      return { bookId: existingByHash.data.id, duplicate: true };
    }

    const filePath = await uploadBookBuffer({
      buffer,
      format,
      contentType,
      fileHash,
    });

    let uploadedCoverPath: string | null = null;

    try {
      const cover = await uploadMetadataCover(metadata.coverPreviewUrl, metadata.coverSource);
      uploadedCoverPath = cover.storagePath;
      const { data: book, error } = await supabaseAdmin
        .from("books")
        .insert({
          user_id: input.admin.id,
          title: metadata.title,
          author: metadata.author,
          description: metadata.description,
          tags: metadata.tags,
          google_books_id: metadata.googleBooksId,
          gutenberg_id: gutenbergId,
          source_provider: sourceProvider,
          source_url: sourceUrl,
          cover_url: cover.publicUrl,
          cover_source: cover.source,
          admin_created_by: input.admin.id,
          is_public: true,
          format,
          file_path: filePath,
          file_hash: fileHash,
          status: "pending",
        })
        .select("id")
        .single();

      if (error || !book) throw new Error(error?.message || "Failed to create book record.");
      await updateImportJob(input.jobId, {
        status: "queued_for_processing",
        book_id: book.id,
        source_provider: sourceProvider,
        source_url: sourceUrl,
      });
      return { bookId: book.id, duplicate: false };
    } catch (error) {
      await supabaseAdmin.storage
        .from(BOOK_STORAGE_BUCKET)
        .remove([filePath, uploadedCoverPath].filter(Boolean) as string[]);
      throw error;
    }
  } catch (error) {
    await updateImportJob(input.jobId, {
      status: "failed",
      error_message: error instanceof Error ? error.message : "Import failed",
    });
    throw error;
  }
}
