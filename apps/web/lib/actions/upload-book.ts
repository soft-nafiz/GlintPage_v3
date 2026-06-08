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

export async function uploadBook(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file selected" };
  }

  if (file.size > MAX_FILE_SIZE) return { error: "File exceeds 50MB limit" };
  if (!ALLOWED_TYPES.includes(file.type) || !hasSupportedExtension(file.name)) {
    return { error: "Only PDF and EPUB files are supported." };
  }

  const title =
    (formData.get("title") as string)?.trim() ||
    file.name.replace(/\.[^.]+$/, "");
  const author = (formData.get("author") as string)?.trim() || null;
  const format = file.type === "application/pdf" ? "pdf" : "epub";

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(buffer).digest("hex");

  const { data: existing, error: existingError } = await supabase
    .from("books")
    .select("id, title")
    .eq("user_id", user.id)
    .eq("file_hash", fileHash)
    .maybeSingle();

  if (existingError) {
    console.error("[uploadBook] duplicate lookup failed:", existingError);
    return { error: "Could not verify this upload. Please try again." };
  }

  if (existing) {
    return {
      error: `You've already uploaded this file as "${existing.title}".`,
    };
  }

  const filePath = `${user.id}/${fileHash}.${format}`;
  const { error: storageError } = await supabase.storage
    .from("library")
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (storageError) {
    console.error("[uploadBook] storage upload failed:", storageError);
    return { error: `Upload failed: ${storageError.message}` };
  }

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
    })
    .select("id")
    .single();

  if (dbError || !book) {
    await supabase.storage.from("library").remove([filePath]);
    console.error("[uploadBook] failed to create book record:", dbError);
    return { error: "Failed to create book record." };
  }

  return { bookId: book.id };
}
