import { NextRequest, NextResponse } from "next/server";
import { getAdminUser, lookupAdminBook } from "@/lib/admin/books";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { title?: string; author?: string };
  try {
    body = (await req.json()) as { title?: string; author?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await lookupAdminBook(admin, body.title || "", body.author);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lookup failed" },
      { status: 400 },
    );
  }
}
