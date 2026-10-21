"use client"
export function PaginationControls({ page, totalPages, total, onChange }: { page: number; totalPages: number; total?: number; onChange: (page: number) => void }) {
  return <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground py-3"><span>{total !== undefined ? `${total} records · ` : ""}Page {page} of {Math.max(1,totalPages)}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => onChange(page-1)} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40">Previous</button><button disabled={page >= totalPages} onClick={() => onChange(page+1)} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40">Next</button></div></nav>
}
