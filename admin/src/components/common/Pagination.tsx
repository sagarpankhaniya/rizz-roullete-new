import ReactPaginate from "react-paginate";

type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

export default function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  disabled = false,
}: PaginationProps) {
  if (totalPages <= 0) return null;

  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
        disabled ? "pointer-events-none opacity-60" : ""
      }`}
    >
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">
        Page {page} of {totalPages} · {total} total
      </p>

      <ReactPaginate
        forcePage={Math.max(0, page - 1)}
        pageCount={totalPages}
        pageRangeDisplayed={3}
        marginPagesDisplayed={1}
        onPageChange={({ selected }) => onPageChange(selected + 1)}
        previousLabel="Previous"
        nextLabel="Next"
        breakLabel="..."
        containerClassName="flex flex-wrap items-center gap-1"
        pageClassName="inline-flex"
        pageLinkClassName="inline-flex min-w-9 items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
        activeClassName="[&>a]:border-brand-500 [&>a]:bg-brand-50 [&>a]:text-brand-600 dark:[&>a]:border-brand-500 dark:[&>a]:bg-brand-500/15 dark:[&>a]:text-brand-400"
        previousClassName="inline-flex"
        previousLinkClassName="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
        nextClassName="inline-flex"
        nextLinkClassName="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
        breakClassName="inline-flex"
        breakLinkClassName="inline-flex min-w-9 items-center justify-center px-2 py-2 text-sm text-gray-500 dark:text-gray-400"
        disabledClassName="opacity-50 [&_a]:pointer-events-none [&_a]:cursor-not-allowed"
      />
    </div>
  );
}
