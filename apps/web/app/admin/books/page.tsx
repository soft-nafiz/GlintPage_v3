import { notFound } from "next/navigation";
import { createMetadata } from "@/lib/seo";
import { getAdminBooksDashboardData } from "@/lib/admin/book-management";
import { AdminBooksDashboardClient } from "./admin-books-dashboard-client";

export const metadata = createMetadata({
  title: "Admin books",
  description: "Admin-only public book import tools for Glintpage.",
  path: "/admin/books",
  noIndex: true,
});

export default async function AdminBooksPage() {
  const data = await getAdminBooksDashboardData();
  if (!data) notFound();

  return (
    <AdminBooksDashboardClient
      adminEmail={data.adminEmail}
      initialBooks={data.books}
      initialCategories={data.categories}
    />
  );
}
