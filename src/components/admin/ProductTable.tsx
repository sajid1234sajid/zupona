"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, Eye, Loader2, Pencil } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { StatusPill, Td, Th, TableScroll, Thumb } from "./ui";
import { archiveProductAction, bulkProductAction } from "@/app/admin/(panel)/products/actions";
import type { AdminProductRow } from "@/lib/adminData";

/** The products table with its selection and bulk-action bar.
 *
 * Client-side only because of the checkboxes; every write it triggers still
 * goes through a server action, which re-checks the caller is an admin. The
 * bulk bar only appears once something is selected so it does not sit there
 * suggesting a control that would do nothing. */
export default function ProductTable({ rows }: { rows: AdminProductRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  const allSelected = rows.length > 0 && selected.length === rows.length;

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );

  return (
    <>
      {selected.length > 0 ? (
        <form
          action={bulkProductAction}
          onSubmit={() => {
            setPending(true);
            setSelected([]);
          }}
          className="mb-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-brand/20 bg-brand-tint/50 px-3 py-2.5"
        >
          {selected.map((id) => (
            <input key={id} type="hidden" name="selected" value={id} />
          ))}
          <span className="text-[13px] font-semibold text-brand-dark">
            {selected.length} selected
          </span>
          <select
            name="bulkAction"
            defaultValue="publish"
            className="h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-[13px] text-neutral-700 outline-none focus:border-brand"
          >
            <option value="publish">Publish</option>
            <option value="draft">Move to draft</option>
            <option value="archive">Archive</option>
          </select>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Apply
          </button>
          <button
            type="button"
            onClick={() => setSelected([])}
            className="text-[13px] font-medium text-neutral-500 transition hover:text-neutral-800"
          >
            Clear
          </button>
        </form>
      ) : null}

      <TableScroll>
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr className="border-b border-neutral-100">
              <Th className="w-9 pl-4 lg:pl-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? [] : rows.map((row) => row.id))}
                  aria-label="Select all products on this page"
                  className="h-4 w-4 rounded accent-[#16a34a]"
                />
              </Th>
              <Th>Image</Th>
              <Th>Product Name</Th>
              <Th>Category</Th>
              <Th>Brand</Th>
              <Th className="text-right">Price</Th>
              <Th className="text-right">Stock</Th>
              <Th>Status</Th>
              <Th className="pr-4 text-right lg:pr-3">Action</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-neutral-50 transition last:border-0 hover:bg-neutral-50/60"
              >
                <Td className="pl-4 lg:pl-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(row.id)}
                    onChange={() => toggle(row.id)}
                    aria-label={`Select ${row.name}`}
                    className="h-4 w-4 rounded accent-[#16a34a]"
                  />
                </Td>
                <Td>
                  <Thumb src={row.image} alt="" size={40} />
                </Td>
                <Td>
                  <Link
                    href={`/admin/products/${row.id}`}
                    className="block max-w-[15rem] truncate font-medium text-neutral-800 hover:text-brand"
                  >
                    {row.name}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap text-neutral-500">{row.categoryName ?? "—"}</Td>
                <Td className="whitespace-nowrap text-neutral-500">{row.brandName ?? "—"}</Td>
                <Td className="whitespace-nowrap text-right font-semibold">
                  {formatPrice(row.price)}
                </Td>
                {/* A product that does not count its units has no level to
                    report, so the column shows a dash rather than a zero that
                    would read as sold out -- and its pill falls through to
                    whatever the product's own status is. */}
                <Td className="text-right">
                  <span
                    className={
                      !row.tracksStock
                        ? "text-neutral-400"
                        : row.stock === 0
                          ? "font-semibold text-red-600"
                          : row.isLowStock
                            ? "font-semibold text-amber-600"
                            : "text-neutral-600"
                    }
                    title={row.tracksStock ? undefined : "Not counting stock"}
                  >
                    {row.tracksStock ? row.stock : "—"}
                  </span>
                </Td>
                <Td>
                  <StatusPill
                    status={
                      row.tracksStock && row.stock === 0
                        ? "out_of_stock"
                        : row.isLowStock
                          ? "low_stock"
                          : row.status
                    }
                    label={
                      row.tracksStock && row.stock === 0
                        ? "Out of Stock"
                        : row.isLowStock
                          ? "Low Stock"
                          : row.status === "active"
                            ? "Published"
                            : undefined
                    }
                  />
                </Td>
                <Td className="pr-4 lg:pr-3">
                  <div className="flex items-center justify-end gap-0.5">
                    {/* A plain anchor, not <Link>: this leaves the panel for
                        the shop, and prefetching it would fetch an RSC payload
                        across origins. */}
                    <a
                      href={`/product/${row.id}`}
                      title="View on the storefront"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                    <Link
                      href={`/admin/products/${row.id}`}
                      title="Edit"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-brand"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <form action={archiveProductAction}>
                      <input type="hidden" name="productId" value={row.id} />
                      <button
                        type="submit"
                        title="Archive (keeps order history)"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </>
  );
}
