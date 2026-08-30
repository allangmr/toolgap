export const DEFAULT_PAGE_SIZE = 10;

export interface PageWindow<T> {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: T[];
}

export function parsePage(raw: string | null): number {
  if (raw == null || raw === "") return 1;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 1;
  return n;
}

export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize = DEFAULT_PAGE_SIZE,
): PageWindow<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    items: items.slice(start, start + pageSize),
  };
}
