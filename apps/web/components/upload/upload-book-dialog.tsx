"use client";

import { useRef, useState, useTransition } from "react";
import type { ComponentProps } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { AlertCircle, BookOpenCheck, FileText, Loader2, Upload } from "lucide-react";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "error"; message: string }
  | { status: "queued"; bookId: string };

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".epub"];
const ALLOWED_TYPES = ["application/pdf", "application/epub+zip", ""];

type UploadBookDialogProps = {
  triggerLabel?: string;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
};

function isSupportedFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return (
    ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext)) &&
    ALLOWED_TYPES.includes(file.type)
  );
}

export function UploadBookDialog({
  triggerLabel = "Upload a book",
  triggerVariant,
  triggerSize,
}: UploadBookDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function reset() {
    setFile(null);
    setDragOver(false);
    setState({ status: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFile(nextFile: File) {
    if (!isSupportedFile(nextFile)) {
      setState({
        status: "error",
        message: "Upload a PDF or EPUB file.",
      });
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      setState({ status: "error", message: "File must be under 50MB." });
      return;
    }

    setFile(nextFile);
    setState({ status: "idle" });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || isPending || state.status === "uploading") return;

    setState({ status: "uploading", progress: 8 });

    const formData = new FormData(e.currentTarget);
    formData.set("file", file);

    startTransition(async () => {
      const interval = window.setInterval(() => {
        setState((prev) =>
          prev.status === "uploading"
            ? { status: "uploading", progress: Math.min(prev.progress + 7, 88) }
            : prev,
        );
      }, 300);

      try {
        const response = await fetch("/api/books/upload", {
          method: "POST",
          body: formData,
        });
        const result = (await response.json().catch(() => ({
          error: "Upload failed. Please try again.",
        }))) as { bookId?: string; error?: string };

        if (!response.ok || result.error || !result.bookId) {
          setState({
            status: "error",
            message: result.error || "Error uploading book",
          });
          return;
        }

        setState({ status: "queued", bookId: result.bookId });
        toast.success("Book queued for processing");
        setOpen(false);
        reset();
        router.push(`/library?processing=${result.bookId}`);
        router.refresh();
      } catch (error) {
        console.error("[UploadBookDialog] upload failed:", error);
        setState({
          status: "error",
          message: "Upload failed. Please check your connection and try again.",
        });
      } finally {
        window.clearInterval(interval);
      }
    });
  }

  const isLoading = state.status === "uploading" || isPending;
  const selectedFileKind = file?.name.toLowerCase().endsWith(".pdf")
    ? "PDF"
    : "EPUB";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen && !isLoading) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className="gap-2">
          <Upload className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload a Book</DialogTitle>
          <DialogDescription>
            Add a PDF or EPUB. Glintpage will extract pages, chapters, and a
            cover when available.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                className={cn(
                  "w-full rounded-2xl border border-dashed p-6 text-center transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  dragOver
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-secondary/60",
                  file && "border-emerald-400 bg-emerald-50",
                )}
                disabled={isLoading}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.epub,application/pdf,application/epub+zip"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files?.[0] && handleFile(e.target.files[0])
                  }
                />

                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <BookOpenCheck className="h-8 w-8 text-emerald-600" />
                    <div>
                      <p className="max-w-[320px] truncate text-sm font-medium text-foreground">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedFileKind} -{" "}
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Drop a PDF or EPUB here
                      </p>
                      <p className="text-xs text-muted-foreground">
                        or click to browse - max 50MB
                      </p>
                    </div>
                  </div>
                )}
              </button>
            </Field>

            <Field>
              <FieldLabel>Title</FieldLabel>
              <Input
                name="title"
                placeholder={
                  file ? file.name.replace(/\.[^.]+$/, "") : "Book title"
                }
                disabled={isLoading}
              />
            </Field>

            <Field>
              <FieldLabel>Author</FieldLabel>
              <Input
                name="author"
                placeholder="Author name, if known"
                disabled={isLoading}
              />
            </Field>

            {state.status === "uploading" && (
              <div className="space-y-2">
                <Progress value={state.progress} />
                <p className="text-xs text-muted-foreground">
                  Uploading and queueing for extraction...
                </p>
              </div>
            )}

            {state.status === "queued" && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Queued for processing. The library will update automatically.
              </p>
            )}

            {state.status === "error" && (
              <FieldError className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {state.message}
              </FieldError>
            )}

            <Button type="submit" disabled={!file || isLoading} className="gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload and process
                </>
              )}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
