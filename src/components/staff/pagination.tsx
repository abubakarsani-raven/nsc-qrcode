import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  /** Current query string without `page` (may be empty). */
  baseQuery: string;
};

function href(baseQuery: string, page: number) {
  const params = new URLSearchParams(baseQuery);
  if (page > 1) params.set("page", String(page));
  else params.delete("page");
  const qs = params.toString();
  return qs ? `/staff?${qs}` : "/staff";
}

/** M3 data-table pagination: range on the left of the controls, icon steps. */
export function Pagination({ page, pageSize, total, baseQuery }: Props) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const stepClass =
    "inline-flex size-10 items-center justify-center rounded-full text-[var(--md-on-surface-variant)] transition-colors hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)]";

  return (
    <nav className="md-pagination" aria-label="Pagination">
      <span className="md-data">
        {first}–{last} of {total}
      </span>
      <span className="flex items-center gap-1">
        {page > 1 ? (
          <Link
            href={href(baseQuery, page - 1)}
            className={stepClass}
            aria-label="Previous page"
            rel="prev"
          >
            <ChevronLeftIcon className="size-5" />
          </Link>
        ) : (
          <span className={`${stepClass} opacity-40`} aria-hidden="true">
            <ChevronLeftIcon className="size-5" />
          </span>
        )}
        {page < lastPage ? (
          <Link
            href={href(baseQuery, page + 1)}
            className={stepClass}
            aria-label="Next page"
            rel="next"
          >
            <ChevronRightIcon className="size-5" />
          </Link>
        ) : (
          <span className={`${stepClass} opacity-40`} aria-hidden="true">
            <ChevronRightIcon className="size-5" />
          </span>
        )}
      </span>
    </nav>
  );
}
