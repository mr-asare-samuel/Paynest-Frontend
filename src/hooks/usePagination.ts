import { useMemo, useState } from "react";

/**
 * Client-side pagination for an already-fetched list.
 *
 *   const { pageItems, ...pg } = usePagination(filtered, 10);
 *   {pageItems.map(...)}
 *   <Pagination page={pg.page} totalPages={pg.totalPages} onPageChange={pg.setPage}
 *              total={pg.total} pageSize={pg.pageSize} onPageSizeChange={pg.setPageSize} />
 *
 * The current page is clamped during render, so a shrinking source list
 * (filter / delete) self-corrects without any state write.
 */
export function usePagination<T>(items: T[], initialPageSize = 10) {
    const [rawPage, setRawPage] = useState(1);
    const [pageSize, setRawPageSize] = useState(initialPageSize);

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(rawPage, 1), totalPages);

    const pageItems = useMemo(
        () => items.slice((page - 1) * pageSize, page * pageSize),
        [items, page, pageSize],
    );

    const setPage = (p: number) => setRawPage(Math.min(Math.max(p, 1), totalPages));
    const setPageSize = (n: number) => { setRawPageSize(n); setRawPage(1); };

    return { pageItems, page, setPage, pageSize, setPageSize, totalPages, total };
}
