"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import {
  BookOpen,
  Check,
  FolderTree,
  Loader2,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AdminBookImportClient } from "./admin-book-import-client";
import {
  deleteAdminCategory,
  deleteAdminPublicBook,
  updateAdminPublicBook,
  upsertAdminCategory,
  type AdminBookUpdateInput,
  type AdminCategory,
  type AdminPublicBook,
} from "@/lib/admin/book-management";
import { slugifyCategory } from "@/lib/library-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenuButton,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type AdminTab = "import" | "books" | "categories";

type EditableBook = AdminBookUpdateInput;

type EditableCategory = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  is_active: boolean;
};

const EMPTY_CATEGORY: EditableCategory = {
  name: "",
  slug: "",
  description: "",
  sort_order: 0,
  is_active: true,
};

export function AdminBooksDashboardClient({
  adminEmail,
  initialBooks,
  initialCategories,
}: {
  adminEmail: string;
  initialBooks: AdminPublicBook[];
  initialCategories: AdminCategory[];
}) {
  const [tab, setTab] = useState<AdminTab>("import");
  const [books, setBooks] = useState(initialBooks);
  const [categories, setCategories] = useState(initialCategories);
  const [query, setQuery] = useState("");
  const [editingBook, setEditingBook] = useState<EditableBook | null>(null);
  const [deletingBook, setDeletingBook] = useState<AdminPublicBook | null>(null);
  const [editingCategory, setEditingCategory] =
    useState<EditableCategory>(EMPTY_CATEGORY);
  const [deletingCategory, setDeletingCategory] =
    useState<AdminCategory | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredBooks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return books;
    return books.filter((book) =>
      [
        book.title,
        book.author || "",
        book.status,
        book.source_provider || "",
        ...book.tags,
        ...book.categories.map((category) => category.name),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [books, query]);

  function openBookEditor(book: AdminPublicBook) {
    setEditingBook({
      id: book.id,
      title: book.title,
      author: book.author,
      description: book.description,
      tags: book.tags,
      cover_url: book.cover_url,
      source_provider: book.source_provider,
      source_url: book.source_url,
      is_featured: book.is_featured,
      featured_rank: book.featured_rank,
      categoryIds: book.categories.map((category) => category.id),
    });
  }

  function saveBook() {
    if (!editingBook) return;
    startTransition(async () => {
      const result = await updateAdminPublicBook(editingBook);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const assignedCategories = categories.filter((category) =>
        editingBook.categoryIds.includes(category.id),
      );
      setBooks((current) =>
        current.map((book) =>
          book.id === editingBook.id
            ? {
                ...book,
                ...editingBook,
                tags: editingBook.tags,
                categories: assignedCategories,
              }
            : book,
        ),
      );
      setEditingBook(null);
      toast.success("Book updated");
    });
  }

  function confirmDeleteBook() {
    if (!deletingBook) return;
    const book = deletingBook;
    startTransition(async () => {
      const result = await deleteAdminPublicBook(book.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setBooks((current) => current.filter((item) => item.id !== book.id));
      setDeletingBook(null);
      toast.success("Public book deleted");
    });
  }

  function saveCategory() {
    startTransition(async () => {
      const result = await upsertAdminCategory(editingCategory);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(editingCategory.id ? "Category updated" : "Category saved");
      window.location.reload();
    });
  }

  function confirmDeleteCategory() {
    if (!deletingCategory) return;
    const category = deletingCategory;
    startTransition(async () => {
      const result = await deleteAdminCategory(category.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setCategories((current) =>
        current.filter((item) => item.id !== category.id),
      );
      setBooks((current) =>
        current.map((book) => ({
          ...book,
          categories: book.categories.filter((item) => item.id !== category.id),
        })),
      );
      setDeletingCategory(null);
      toast.success("Category deleted");
    });
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Admin
          </p>
          <h1 className="font-heading text-2xl font-semibold text-primary">
            Books
          </h1>
          <p className="text-xs text-muted-foreground">{adminEmail}</p>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenuButton active={tab === "import"} onClick={() => setTab("import")}>
            <Upload className="h-4 w-4" />
            Import book
          </SidebarMenuButton>
          <SidebarMenuButton active={tab === "books"} onClick={() => setTab("books")}>
            <BookOpen className="h-4 w-4" />
            Public books
          </SidebarMenuButton>
          <SidebarMenuButton
            active={tab === "categories"}
            onClick={() => setTab("categories")}
          >
            <FolderTree className="h-4 w-4" />
            Categories
          </SidebarMenuButton>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <div className="mb-5 flex gap-2 lg:hidden">
          {[
            ["import", "Import", Upload],
            ["books", "Books", BookOpen],
            ["categories", "Categories", FolderTree],
          ].map(([value, label, Icon]) => (
            <Button
              key={String(value)}
              type="button"
              variant={tab === value ? "default" : "outline"}
              onClick={() => setTab(value as AdminTab)}
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              {String(label)}
            </Button>
          ))}
        </div>

        {tab === "import" && (
          <AdminBookImportClient adminEmail={adminEmail} embedded />
        )}

        {tab === "books" && (
          <section className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Public library
                </p>
                <h2 className="font-heading text-3xl font-semibold">
                  Public books
                </h2>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search public books..."
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid gap-3">
              {filteredBooks.map((book) => (
                <Card key={book.id} className="shadow-none">
                  <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
                    <BookThumb book={book} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold">{book.title}</h3>
                        {book.is_featured && (
                          <Badge className="gap-1">
                            <Star className="h-3 w-3 fill-current" />
                            Featured
                          </Badge>
                        )}
                        <Badge variant="outline">{book.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {book.author || "Unknown author"} ·{" "}
                        {book.source_provider || "Glintpage"}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {book.description || "No description yet."}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {book.categories.map((category) => (
                          <Badge key={category.id} variant="secondary">
                            {category.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openBookEditor(book)}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setDeletingBook(book)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {tab === "categories" && (
          <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <Card className="h-fit shadow-none">
              <CardHeader>
                <CardTitle>
                  {editingCategory.id ? "Edit category" : "New category"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Name">
                  <Input
                    value={editingCategory.name}
                    onChange={(event) => {
                      const name = event.target.value;
                      setEditingCategory((current) => ({
                        ...current,
                        name,
                        slug: current.id ? current.slug : slugifyCategory(name),
                      }));
                    }}
                  />
                </Field>
                <Field label="Slug">
                  <Input
                    value={editingCategory.slug}
                    onChange={(event) =>
                      setEditingCategory((current) => ({
                        ...current,
                        slug: slugifyCategory(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    value={editingCategory.description}
                    onChange={(event) =>
                      setEditingCategory((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    rows={3}
                  />
                </Field>
                <Field label="Sort order">
                  <Input
                    type="number"
                    value={editingCategory.sort_order}
                    onChange={(event) =>
                      setEditingCategory((current) => ({
                        ...current,
                        sort_order: Number(event.target.value || 0),
                      }))
                    }
                  />
                </Field>
                <label className="flex items-center justify-between rounded-2xl border p-3 text-sm">
                  Active
                  <Switch
                    checked={editingCategory.is_active}
                    onCheckedChange={(checked) =>
                      setEditingCategory((current) => ({
                        ...current,
                        is_active: checked,
                      }))
                    }
                  />
                </label>
                <div className="flex gap-2">
                  <Button disabled={pending} onClick={saveCategory}>
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Save
                  </Button>
                  {editingCategory.id && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingCategory(EMPTY_CATEGORY)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {categories.map((category) => (
                <Card key={category.id} className="shadow-none">
                  <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{category.name}</h3>
                        <Badge variant={category.is_active ? "secondary" : "outline"}>
                          {category.is_active ? "Active" : "Hidden"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        /{category.slug} · sort {category.sort_order}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {category.description || "No description."}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setEditingCategory({
                            id: category.id,
                            name: category.name,
                            slug: category.slug,
                            description: category.description || "",
                            sort_order: category.sort_order,
                            is_active: category.is_active,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setDeletingCategory(category)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </SidebarInset>

      <BookEditDialog
        book={editingBook}
        categories={categories}
        pending={pending}
        onChange={setEditingBook}
        onClose={() => setEditingBook(null)}
        onSave={saveBook}
      />

      <AlertDialog open={Boolean(deletingBook)} onOpenChange={(open) => !open && setDeletingBook(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete public book?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes “{deletingBook?.title}”, its reader pages,
              translations, audio, progress, cover, source file, and EPUB assets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeleteBook}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deletingCategory)}
        onOpenChange={(open) => !open && setDeletingCategory(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes “{deletingCategory?.name}” and its book assignments.
              Books will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeleteCategory}>
              Delete category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}

function BookEditDialog({
  book,
  categories,
  pending,
  onChange,
  onClose,
  onSave,
}: {
  book: EditableBook | null;
  categories: AdminCategory[];
  pending: boolean;
  onChange: (book: EditableBook | null) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!book) return null;

  const patch = (patchValue: Partial<EditableBook>) =>
    onChange({ ...book, ...patchValue });

  return (
    <Dialog open={Boolean(book)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit public book</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title">
              <Input value={book.title} onChange={(event) => patch({ title: event.target.value })} />
            </Field>
            <Field label="Author">
              <Input value={book.author || ""} onChange={(event) => patch({ author: event.target.value })} />
            </Field>
          </div>
          <Field label="Description">
            <Textarea
              value={book.description || ""}
              rows={4}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </Field>
          <Field label="Tags">
            <Input
              value={book.tags.join(", ")}
              onChange={(event) =>
                patch({
                  tags: event.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <Field label="Cover URL">
            <Input value={book.cover_url || ""} onChange={(event) => patch({ cover_url: event.target.value })} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Source provider">
              <Input
                value={book.source_provider || ""}
                onChange={(event) => patch({ source_provider: event.target.value })}
              />
            </Field>
            <Field label="Source URL">
              <Input value={book.source_url || ""} onChange={(event) => patch({ source_url: event.target.value })} />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-2xl border p-3 text-sm">
              Featured
              <Switch
                checked={book.is_featured}
                onCheckedChange={(checked) => patch({ is_featured: checked })}
              />
            </label>
            <Field label="Featured rank">
              <Input
                type="number"
                value={book.featured_rank}
                onChange={(event) => patch({ featured_rank: Number(event.target.value || 0) })}
              />
            </Field>
          </div>
          <Field label="Categories">
            <div className="flex flex-wrap gap-2 rounded-2xl border p-3">
              {categories.map((category) => {
                const selected = book.categoryIds.includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() =>
                      patch({
                        categoryIds: selected
                          ? book.categoryIds.filter((id) => id !== category.id)
                          : [...book.categoryIds, category.id],
                      })
                    }
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted",
                    )}
                  >
                    {selected && <Check className="h-3 w-3" />}
                    {category.name}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={onSave}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BookThumb({ book }: { book: AdminPublicBook }) {
  return (
    <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
      {book.cover_url ? (
        <Image
          src={book.cover_url}
          alt={book.title}
          fill
          sizes="56px"
          className="object-cover"
          crossOrigin="anonymous"
        />
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
