"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Loader2,
  Search,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AdminBookMetadata,
  AdminLookupResult,
  PublicBookCandidate,
} from "@/lib/admin/books";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const EMPTY_METADATA: AdminBookMetadata = {
  title: "",
  author: null,
  description: null,
  tags: [],
  googleBooksId: null,
  coverPreviewUrl: null,
  coverSource: null,
};

type ImportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; bookId: string; duplicate: boolean };

function metadataTags(metadata: AdminBookMetadata) {
  return metadata.tags.join(", ");
}

function candidateKey(candidate: PublicBookCandidate) {
  return `${candidate.provider}:${candidate.externalId}`;
}

function providerLabel(provider: PublicBookCandidate["provider"]) {
  switch (provider) {
    case "standard_ebooks":
      return "Standard Ebooks";
    case "internet_archive":
      return "Internet Archive";
    case "gutenberg":
    default:
      return "Project Gutenberg";
  }
}

export function AdminBookImportClient({ adminEmail }: { adminEmail: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [lookup, setLookup] = useState<AdminLookupResult | null>(null);
  const [metadata, setMetadata] = useState<AdminBookMetadata>(EMPTY_METADATA);
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<
    string | null
  >(null);
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [lookupPending, startLookup] = useTransition();
  const [importPending, startImport] = useTransition();
  const [state, setState] = useState<ImportState>({ status: "idle" });

  const selectedCandidate = useMemo(
    () =>
      lookup?.candidates.find(
        (candidate) => candidateKey(candidate) === selectedCandidateKey,
      ) || null,
    [lookup, selectedCandidateKey],
  );
  const hasUsableSourceCandidates = Boolean(
    lookup?.candidates.some((candidate) => candidate.epubUrl),
  );

  function updateMetadata(patch: Partial<AdminBookMetadata>) {
    setMetadata((current) => ({ ...current, ...patch }));
  }

  function runLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "idle" });
    setLookup(null);
    setSelectedCandidateKey(null);
    setManualFile(null);

    startLookup(async () => {
      const response = await fetch("/api/admin/books/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author }),
      });
      const result = (await response.json()) as AdminLookupResult & {
        error?: string;
      };

      if (!response.ok || result.error) {
        setState({ status: "error", message: result.error || "Lookup failed" });
        return;
      }

      const firstUsable = result.candidates.find(
        (candidate) => candidate.epubUrl,
      );
      setLookup(result);
      setMetadata(result.metadata);
      setSelectedCandidateKey(firstUsable ? candidateKey(firstUsable) : null);
    });
  }

  function importPublicSource() {
    if (!selectedCandidate || importPending) return;
    setState({ status: "idle" });

    startImport(async () => {
      const response = await fetch("/api/admin/books/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: lookup?.jobId,
          metadata,
          selectedCandidate,
        }),
      });
      const result = (await response.json()) as {
        bookId?: string;
        duplicate?: boolean;
        error?: string;
      };

      if (!response.ok || result.error || !result.bookId) {
        setState({ status: "error", message: result.error || "Import failed" });
        return;
      }

      setState({
        status: "success",
        bookId: result.bookId,
        duplicate: Boolean(result.duplicate),
      });
      toast.success(
        result.duplicate ? "Book already exists" : "Book queued for processing",
      );
    });
  }

  function importManual() {
    if (!manualFile || importPending) return;
    setState({ status: "idle" });

    const formData = new FormData();
    formData.set("file", manualFile);
    if (lookup?.jobId) formData.set("jobId", lookup.jobId);
    formData.set("title", metadata.title);
    formData.set("author", metadata.author || "");
    formData.set("description", metadata.description || "");
    formData.set("tags", metadataTags(metadata));
    formData.set("googleBooksId", metadata.googleBooksId || "");
    formData.set("coverPreviewUrl", metadata.coverPreviewUrl || "");
    formData.set("coverSource", metadata.coverSource || "");

    startImport(async () => {
      const response = await fetch("/api/admin/books/import", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        bookId?: string;
        duplicate?: boolean;
        error?: string;
      };

      if (!response.ok || result.error || !result.bookId) {
        setState({ status: "error", message: result.error || "Upload failed" });
        return;
      }

      setState({
        status: "success",
        bookId: result.bookId,
        duplicate: Boolean(result.duplicate),
      });
      toast.success(
        result.duplicate ? "Book already exists" : "Book queued for processing",
      );
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="mb-8 flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Admin
        </p>
        <h1 className="font-heading text-4xl font-semibold text-primary">
          Public book import
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Signed in as {adminEmail}. Search a title, confirm a verified
          public-domain source, or upload a fallback file while keeping the best
          metadata.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">Find a book</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={runLookup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Pride and Prejudice"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder="Jane Austen"
                />
              </div>
              <Button
                type="submit"
                disabled={lookupPending}
                className="w-full gap-2"
              >
                {lookupPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search metadata
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {lookup && (
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-xl">Book metadata</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-[140px_1fr]">
                <div className="aspect-[2/3] overflow-hidden rounded-lg border bg-muted">
                  {metadata.coverPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={metadata.coverPreviewUrl}
                      alt={metadata.title}
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No cover
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      Job: {lookup.status.replaceAll("_", " ")}
                    </Badge>
                    {lookup.metadataSources.map((source) => (
                      <Badge key={source} variant="secondary">
                        {source.replaceAll("_", " ")}
                      </Badge>
                    ))}
                    {metadata.coverSource && (
                      <Badge variant="outline">
                        cover: {metadata.coverSource.replaceAll("_", " ")}
                      </Badge>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={metadata.title}
                        onChange={(event) =>
                          updateMetadata({ title: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Author</Label>
                      <Input
                        value={metadata.author || ""}
                        onChange={(event) =>
                          updateMetadata({ author: event.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={metadata.description || ""}
                      onChange={(event) =>
                        updateMetadata({ description: event.target.value })
                      }
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <Input
                      value={metadataTags(metadata)}
                      onChange={(event) =>
                        updateMetadata({
                          tags: event.target.value
                            .split(",")
                            .map((tag) => tag.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Fiction, Classics"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {lookup && (
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <BookOpen className="h-5 w-5" />
                  Public-domain source candidates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!hasUsableSourceCandidates && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    No verified public-domain EPUB source found. Use the manual
                    upload fallback below.
                  </div>
                )}

                <div className="space-y-3">
                  {lookup.candidates.map((candidate) => (
                    <button
                      key={candidateKey(candidate)}
                      type="button"
                      onClick={() =>
                        candidate.epubUrl &&
                        setSelectedCandidateKey(candidateKey(candidate))
                      }
                      disabled={!candidate.epubUrl}
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        selectedCandidateKey === candidateKey(candidate)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      } ${!candidate.epubUrl ? "cursor-not-allowed opacity-55" : ""}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {candidate.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {candidate.author || "Unknown author"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {providerLabel(candidate.provider)}
                          </Badge>
                          <Badge
                            variant={
                              candidate.epubUrl ? "secondary" : "outline"
                            }
                          >
                            {candidate.epubUrl ? "EPUB" : "No EPUB"}
                          </Badge>
                          {candidate.downloadCount > 0 && (
                            <Badge variant="outline">
                              {candidate.downloadCount.toLocaleString()}{" "}
                              downloads
                            </Badge>
                          )}
                        </div>
                      </div>
                      {candidate.description && (
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                          {candidate.description}
                        </p>
                      )}
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {[
                          candidate.licenseLabel,
                          ...candidate.bookshelves,
                          ...candidate.subjects,
                        ]
                          .filter(Boolean)
                          .slice(0, 5)
                          .join(" · ")}
                      </p>
                    </button>
                  ))}
                </div>

                <Button
                  onClick={importPublicSource}
                  disabled={!selectedCandidate?.epubUrl || importPending}
                  className="gap-2"
                >
                  {importPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Import selected public EPUB
                </Button>
              </CardContent>
            </Card>
          )}

          {lookup && (
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Upload className="h-5 w-5" />
                  Manual fallback
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.epub,application/pdf,application/epub+zip"
                  className="hidden"
                  onChange={(event) =>
                    setManualFile(event.target.files?.[0] || null)
                  }
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center hover:border-primary/60"
                >
                  <Upload className="mb-2 h-7 w-7 text-primary" />
                  <span className="text-sm font-medium">
                    {manualFile ? manualFile.name : "Choose PDF or EPUB"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Uses the metadata and cover above
                  </span>
                </button>
                <Button
                  onClick={importManual}
                  disabled={!manualFile || importPending}
                  variant="secondary"
                  className="gap-2"
                >
                  {importPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload fallback file
                </Button>
              </CardContent>
            </Card>
          )}

          {state.status === "error" && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {state.message}
            </div>
          )}

          {state.status === "success" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <span>
                {state.duplicate
                  ? "This public book already exists."
                  : "Public book queued for processing."}
              </span>
              <Link
                href={`/library?processing=${state.bookId}`}
                className="font-medium underline"
              >
                View in library
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
