"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadBook } from "@/lib/actions/upload-book";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Upload } from "lucide-react";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import { toast } from "sonner";

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "error"; message: string }
  | { status: "queued"; bookId: string };

export function UploadBookDialog() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const ALLOWED = ["application/pdf", "application/epub+zip"];

  function handleFile(f: File) {
    if (!ALLOWED.includes(f.type)) {
      setState({
        status: "error",
        message: "Only PDF and EPUB files are supported.",
      });
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setState({ status: "error", message: "File must be under 50MB." });
      return;
    }
    setFile(f);
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
    if (!file) return;

    setState({ status: "uploading", progress: 0 });

    const formData = new FormData(e.currentTarget);
    formData.set("file", file);

    startTransition(async () => {
      // Fake progress tick while the server action runs
      const interval = setInterval(() => {
        setState((prev) =>
          prev.status === "uploading"
            ? { status: "uploading", progress: Math.min(prev.progress + 8, 85) }
            : prev,
        );
      }, 300);

      const result = await uploadBook(formData);
      clearInterval(interval);

      if ("error" in result) {
        setState({
          status: "error",
          message: result.error || "Error uploading book",
        });
      } else {
        setState({ status: "queued", bookId: result.bookId });
        setTimeout(() => {
          router.push(`/library`);
          router.refresh();

          toast.success("Book uploaded successfully");
        }, 1500);
      }
    });
  }

  const isLoading = state.status === "uploading" || isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          Upload a book <Upload />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload A Book</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${dragOver ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"}
              ${file ? "border-green-400 bg-green-50" : ""}
            `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.epub"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files?.[0] && handleFile(e.target.files[0])
                  }
                />
                {file ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-2xl">
                      {file.name.endsWith(".pdf") ? "📄" : "📚"}
                    </span>
                    <p className="text-sm font-medium text-green-700 truncate max-w-[260px]">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-3xl">☁️</span>
                    <p className="text-sm font-medium text-gray-600">
                      Drop your PDF or EPUB here
                    </p>
                    <p className="text-xs text-gray-400">
                      or click to browse · max 50MB
                    </p>
                  </div>
                )}
              </div>
            </Field>
            <Field>
              <FieldLabel>Title</FieldLabel>
              <Input
                name="title"
                placeholder={
                  file ? file.name.replace(/\.[^.]+$/, "") : "Book title"
                }
              />
            </Field>
            <Field>
              <FieldLabel>Author</FieldLabel>
              <Input name="author" placeholder="Author name" />
            </Field>

            {state.status === "uploading" && (
              <Progress value={state.progress} />
            )}

            {state.status === "queued" && (
              <p className="test-sm text-center text-green-500 font-medium">
                Queued for processing - redirecting...
              </p>
            )}

            {state.status === "error" && (
              <FieldError>{state.message}</FieldError>
            )}

            <Button type="submit" disabled={!file || isLoading}>
              {isLoading ? "Uploading..." : "Upload"} <Upload />
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
