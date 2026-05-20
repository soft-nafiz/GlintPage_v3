"use server";

import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import { createHash } from "node:crypto";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ["application/pdf", "application/epub+zip"];

export async function uploadBook(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const file = formData.get("file") as File;
  const title =
    (formData.get("title") as string)?.trim() ||
    file.name.replace(/\.[^.]+$/, "");
  const author = (formData.get("author") as string)?.trim() || null;

  if (!file || file.size == 0) return { error: "No file selected" };
  if (file.size > MAX_FILE_SIZE) return { error: "File exceeds 50MB limit" };
  if (!ALLOWED_TYPES.includes(file.type))
    return { error: "Only PDF and EPUB files are supported." };

  const format = file.type === "application/pdf" ? "pdf" : "epub";

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(buffer).digest("hex");

  const { data: existing } = await supabase
    .from("books")
    .select("id, title")
    .eq("user_id", user.id)
    .eq("file_hash", fileHash)
    .maybeSingle();

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
      upsert: false, // Don't overwrite — if it exists, something is wrong
    });

  if (storageError) {
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
    console.log(dbError);
    return { error: `Failed to create book record., ${dbError}` };
  }

  return { bookId: book.id };
}
