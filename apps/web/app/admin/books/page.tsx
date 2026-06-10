import { notFound } from "next/navigation";
import { createMetadata } from "@/lib/seo";
import { getAdminUser } from "@/lib/admin/books";
import { AdminBookImportClient } from "./admin-book-import-client";

export const metadata = createMetadata({
  title: "Admin books",
  description: "Admin-only public book import tools for Glintpage.",
  path: "/admin/books",
  noIndex: true,
});

export default async function AdminBooksPage() {
  const admin = await getAdminUser();
  if (!admin) notFound();

  return <AdminBookImportClient adminEmail={admin.email || "Admin"} />;
}
