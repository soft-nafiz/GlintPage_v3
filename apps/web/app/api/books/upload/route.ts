import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "application/epub+zip", ""];
const ALLOWED_EXTENSIONS = [".pdf", ".epub"];

function hasSupportedExtension(fileName: string) {
  const lowerName = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

function getFormat(file: File) {
  const lowerName = file.name.toLowerCase();
  if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "pdf";
  }
  if (file.type === "application/epub+zip" || lowerName.endsWith(".epub")) {
    return "epub";
  }
  return null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (error) {
    console.error("[uploadBook] form parse failed:", error);
    return NextResponse.json(
      { error: "Upload was interrupted. Please choose the file again and retry." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file selected" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File exceeds 50MB limit" },
      { status: 413 },
    );
  }

  const format = getFormat(file);
  if (
    !format ||
    !ALLOWED_TYPES.includes(file.type) ||
    !hasSupportedExtension(file.name)
  ) {
    return NextResponse.json(
      { error: "Only PDF and EPUB files are supported." },
      { status: 400 },
    );
  }

  const title =
    (formData.get("title") as string)?.trim() ||
    file.name.replace(/\.[^.]+$/, "");
  const author = (formData.get("author") as string)?.trim() || null;

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
    return NextResponse.json(
      { error: "Could not verify this upload. Please try again." },
      { status: 500 },
    );
  }

  if (existing) {
    return NextResponse.json(
      { error: `You've already uploaded this file as "${existing.title}".` },
      { status: 409 },
    );
  }

  const filePath = `${user.id}/${fileHash}.${format}`;
  const { error: storageError } = await supabase.storage
    .from("library")
    .upload(filePath, buffer, {
      contentType: file.type || (format === "pdf" ? "application/pdf" : "application/epub+zip"),
      upsert: true,
    });

  if (storageError) {
    console.error("[uploadBook] storage upload failed:", storageError);
    return NextResponse.json(
      { error: `Upload failed: ${storageError.message}` },
      { status: 500 },
    );
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
    return NextResponse.json(
      { error: "Failed to create book record." },
      { status: 500 },
    );
  }

  return NextResponse.json({ bookId: book.id });
}
