"use client";

import { useRef, useState, useTransition } from "react";
import type { ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { adminUploadBook } from "@/lib/actions/admin-upload-book";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import {
  AlertCircle,
  BookOpenCheck,
  FileText,
  Loader2,
  ShieldAlert,
  Upload,
} from "lucide-react";
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

type AdminUploadBookDialogProps = {
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

export function AdminUploadBookDialog({
  triggerLabel = "Upload Marketplace Book",
  triggerVariant = "default",
  triggerSize,
}: AdminUploadBookDialogProps) {
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
        message: "Upload a valid PDF or EPUB file.",
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
            ? { status: "uploading", progress: Math.min(prev.progress + 6, 90) }
            : prev,
        );
      }, 250);

      try {
        const result = await adminUploadBook(formData);

        if ("error" in result) {
          setState({
            status: "error",
            message: result.error || "Error uploading book",
          });
          return;
        }

        setState({ status: "queued", bookId: result.bookId });
        toast.success("Public book processing started!");
        setOpen(false);
        reset();
        router.refresh();
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
        <Button
          variant={triggerVariant}
          size={triggerSize}
          className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
        >
          <ShieldAlert className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <ShieldAlert className="h-5 w-5" /> Admin Portal: Add Global Book
          </DialogTitle>
          <DialogDescription>
            Publish a book directly into Glintpage's public domain catalog. This
            makes it instantly viewable on the storefront catalog layout.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup className="space-y-4">
            {/* File Drag and Drop zone */}
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
                  "w-full rounded-2xl border border-dashed p-5 text-center transition-colors focus:outline-none",
                  dragOver
                    ? "border-amber-500 bg-amber-50"
                    : "border-border hover:border-amber-500/50 hover:bg-secondary/60",
                  file && "border-emerald-400 bg-emerald-50/50",
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
                      <p className="max-w-[380px] truncate text-sm font-medium text-foreground">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedFileKind} —{" "}
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Drop asset file here
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PDF or EPUB files up to 50MB
                      </p>
                    </div>
                  </div>
                )}
              </button>
            </Field>

            {/* Title & Author Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Book Title</FieldLabel>
                <Input
                  name="title"
                  required
                  placeholder={
                    file
                      ? file.name.replace(/\.[^.]+$/, "")
                      : "The Midnight Library"
                  }
                  disabled={isLoading}
                />
              </Field>

              <Field>
                <FieldLabel>Author Name</FieldLabel>
                <Input
                  name="author"
                  required
                  placeholder="Matt Haig"
                  disabled={isLoading}
                />
              </Field>
            </div>

            {/* Description Synopsis Block */}
            <Field>
              <FieldLabel>Synopsis / Book Description</FieldLabel>
              <textarea
                name="description"
                rows={3}
                required
                placeholder="Between life and death there is a library. Its shelves hold infinite books..."
                disabled={isLoading}
                className={cn(
                  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                )}
              />
            </Field>

            {/* Categorization Tags & Language */}
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Tags (Comma Separated)</FieldLabel>
                <Input
                  name="tags"
                  placeholder="Fiction, Philosophy, Bestseller"
                  disabled={isLoading}
                />
              </Field>

              <Field>
                <FieldLabel>Language</FieldLabel>
                <Input
                  name="language"
                  defaultValue="English"
                  placeholder="English"
                  disabled={isLoading}
                />
              </Field>
            </div>

            {/* Public Domain Visibility Toggle */}
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
              <input
                id="is_public"
                name="is_public"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <label
                htmlFor="is_public"
                className="text-xs text-amber-900 font-medium cursor-pointer selection:bg-transparent"
              >
                List automatically inside Public Domain Marketplace/Storefront
                catalog
              </label>
            </div>

            {/* Loading/Status Layout Blocks */}
            {state.status === "uploading" && (
              <div className="space-y-2">
                <Progress
                  value={state.progress}
                  className="[&>div]:bg-amber-500"
                />
                <p className="text-xs text-muted-foreground animate-pulse">
                  Uploading assets, analyzing indices, and setting store
                  flags...
                </p>
              </div>
            )}

            {state.status === "error" && (
              <FieldError className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                {state.message}
              </FieldError>
            )}

            {/* Action Triggers */}
            <Button
              type="submit"
              disabled={!file || isLoading}
              className="gap-2 w-full bg-amber-600 hover:bg-amber-700 text-white mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing Public Upload...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Publish to Glintpage Store
                </>
              )}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
