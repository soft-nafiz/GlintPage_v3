"use server";

import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import { createHash } from "node:crypto";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "application/epub+zip"];
const ALLOWED_EXTENSIONS = [".pdf", ".epub"];

function hasSupportedExtension(fileName: string) {
  const lowerName = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

export async function adminUploadBook(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // TODO: Add your custom admin check here if you have a roles table or metadata
  // e.g., if (user.app_metadata.role !== 'admin') return { error: "Unauthorized" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file selected" };
  }

  if (file.size > MAX_FILE_SIZE) return { error: "File exceeds 50MB limit" };
  if (!ALLOWED_TYPES.includes(file.type) || !hasSupportedExtension(file.name)) {
    return { error: "Only PDF and EPUB files are supported." };
  }

  // Extract base form items
  const title =
    (formData.get("title") as string)?.trim() ||
    file.name.replace(/\.[^.]+$/, "");
  const author = (formData.get("author") as string)?.trim() || null;
  const format = file.type === "application/pdf" ? "pdf" : "epub";

  // Extract new Admin Store fields
  const description = (formData.get("description") as string)?.trim() || null;
  const language = (formData.get("language") as string)?.trim() || "English";
  const isPublic =
    formData.get("is_public") === "true" || formData.get("is_public") === "on";

  // Parse comma-separated tags string into a string array: "Fiction, Sci-Fi" -> ["Fiction", "Sci-Fi"]
  const tagsRaw = formData.get("tags") as string;
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    : [];

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(buffer).digest("hex");

  // Check for duplicates in public domain or user space
  const { data: existing, error: existingError } = await supabase
    .from("books")
    .select("id, title")
    .eq("file_hash", fileHash)
    .maybeSingle();

  if (existingError) {
    console.error("[adminUploadBook] duplicate lookup failed:", existingError);
    return { error: "Could not verify this upload. Please try again." };
  }

  if (existing) {
    return { error: `This file already exists as "${existing.title}".` };
  }

  // Upload to public path structure inside your library bucket
  const filePath = `public-domain/${fileHash}.${format}`;
  const { error: storageError } = await supabase.storage
    .from("library")
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (storageError) {
    console.error("[adminUploadBook] storage upload failed:", storageError);
    return { error: `Upload failed: ${storageError.message}` };
  }

  // Insert complete record with store metrics matching the UI template card
  const { data: book, error: dbError } = await supabase
    .from("books")
    .insert({
      user_id: user.id,
      title,
      author,
      format,
      file_path: filePath,
      file_hash: fileHash,
      status: "pending",
      description,
      tags, // Matches text[] column type seamlessly
      language,
      is_public: isPublic,
    })
    .select("id")
    .single();

  if (dbError || !book) {
    await supabase.storage.from("library").remove([filePath]);
    console.error(
      "[adminUploadBook] failed to create public book record:",
      dbError,
    );
    return { error: "Failed to create database book record." };
  }

  return { bookId: book.id };
}
