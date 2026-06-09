import { NextRequest, NextResponse } from "next/server";

const SUPABASE_HOST = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "https://eiwqqsvrrrvyvjwcqlzu.supabase.co",
).hostname;

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "Missing image URL" }, { status: 400 });
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  if (
    imageUrl.protocol !== "https:" ||
    imageUrl.hostname !== SUPABASE_HOST ||
    !imageUrl.pathname.startsWith("/storage/v1/object/public/")
  ) {
    return NextResponse.json({ error: "Image host not allowed" }, { status: 400 });
  }

  const upstream = await fetch(imageUrl, {
    headers: { accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" },
    next: { revalidate: 60 * 60 * 24 * 30 },
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Image not found" }, { status: upstream.status || 404 });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Access-Control-Allow-Origin", "*");

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new NextResponse(upstream.body, { headers });
}
