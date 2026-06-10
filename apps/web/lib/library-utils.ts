export function slugifyCategory(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function categoryNameFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatReadingDuration(
  seconds?: number | null,
  emptyLabel = "0 min",
) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds || 0)));
  if (safeSeconds === 0) return emptyLabel;
  if (safeSeconds < 60) return "<1 min";

  const minutes = Math.round(safeSeconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = safeSeconds / 3600;
  return `${hours.toFixed(hours < 10 ? 1 : 0)} hrs`;
}
