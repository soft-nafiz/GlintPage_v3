import { NextRequest, NextResponse } from "next/server";
import {
  type AdminBookMetadata,
  type PublicBookCandidate,
  createAdminPublicBook,
  getAdminUser,
} from "@/lib/admin/books";

export const runtime = "nodejs";

function cleanString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function metadataFromFormData(formData: FormData): AdminBookMetadata {
  const tags = cleanString(formData.get("tags"))
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    title: cleanString(formData.get("title")),
    author: cleanString(formData.get("author")) || null,
    description: cleanString(formData.get("description")) || null,
    tags,
    googleBooksId: cleanString(formData.get("googleBooksId")) || null,
    coverPreviewUrl: cleanString(formData.get("coverPreviewUrl")) || null,
    coverSource: cleanString(formData.get("coverSource")) || null,
  };
}

function jobIdFromFormData(formData: FormData) {
  return cleanString(formData.get("jobId")) || null;
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      const result = await createAdminPublicBook({
        admin,
        jobId: jobIdFromFormData(formData),
        metadata: metadataFromFormData(formData),
        file: file instanceof File ? file : null,
      });
      return NextResponse.json(result);
    }

    const body = (await req.json()) as {
      jobId?: string;
      metadata?: AdminBookMetadata;
      selectedCandidate?: PublicBookCandidate;
      gutenbergId?: number;
    };

    if (!body.metadata) {
      return NextResponse.json({ error: "Metadata is required" }, { status: 400 });
    }

    const result = await createAdminPublicBook({
      admin,
      jobId: body.jobId,
      metadata: body.metadata,
      selectedCandidate: body.selectedCandidate,
      gutenbergId: body.gutenbergId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 400 },
    );
  }
}
