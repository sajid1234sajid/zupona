"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { BadgeCheck, Check, Loader2, MessageSquare, ThumbsUp, Trash2, X } from "lucide-react";
import { formatRelative } from "@/lib/format";
import { Avatar, StatusPill, Td, Th, TableScroll, Thumb } from "./ui";
import {
  bulkReviewAction,
  deleteReviewAction,
  replyToReviewAction,
  setReviewStatusAction,
} from "@/app/admin/(panel)/products/reviews/actions";
import type { AdminReviewRow } from "@/lib/adminData";

function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="whitespace-nowrap text-xs text-accent-orange"
      aria-label={`${rating} out of 5 stars`}
    >
      {"★".repeat(rating)}
      <span className="text-neutral-200">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

/** The moderation queue.
 *
 * Approve/reject are one click on the row rather than behind a menu, because
 * clearing a backlog is the whole job of this screen. The reply box is
 * collapsed by default so a long thread doesn't push the next review off the
 * page. */
export default function ReviewTable({ rows }: { rows: AdminReviewRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
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
          action={bulkReviewAction}
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
            defaultValue="approved"
            className="h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-[13px] text-neutral-700 outline-none focus:border-brand"
          >
            <option value="approved">Approve</option>
            <option value="pending">Move to pending</option>
            <option value="rejected">Reject</option>
            <option value="spam">Mark as spam</option>
            <option value="delete">Delete permanently</option>
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
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b border-neutral-100">
              <Th className="w-9 pl-4 lg:pl-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? [] : rows.map((row) => row.id))}
                  aria-label="Select all reviews on this page"
                  className="h-4 w-4 rounded accent-[#16a34a]"
                />
              </Th>
              <Th>Product</Th>
              <Th>Customer</Th>
              <Th>Rating</Th>
              <Th>Review</Th>
              <Th>Media</Th>
              <Th>Status</Th>
              <Th className="text-right">Helpful</Th>
              <Th className="pr-4 text-right lg:pr-3">Action</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.id}>
                <tr
                  className="border-b border-neutral-50 align-top transition hover:bg-neutral-50/60"
                >
                  <Td className="pl-4 lg:pl-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={`Select review of ${row.productName}`}
                      className="h-4 w-4 rounded accent-[#16a34a]"
                    />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Thumb src={row.productImage} alt="" size={36} />
                      <Link
                        href={`/admin/products/${row.productId}`}
                        className="block max-w-[10rem] truncate text-[13px] font-medium text-neutral-800 hover:text-brand"
                      >
                        {row.productName}
                      </Link>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar src={row.customerAvatar} name={row.customerName} size={30} />
                      <div className="min-w-0">
                        <p className="max-w-[8rem] truncate text-[13px]">{row.customerName}</p>
                        {row.isVerifiedPurchase ? (
                          <p className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                            <BadgeCheck className="h-3 w-3" />
                            Verified
                          </p>
                        ) : (
                          <p className="text-[10px] text-neutral-400">Not verified</p>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <Stars rating={row.rating} />
                  </Td>
                  <Td>
                    <p className="max-w-[16rem] text-[13px] text-neutral-700">
                      {row.title ? <strong className="block truncate">{row.title}</strong> : null}
                      <span className="line-clamp-2">{row.body ?? "No written review."}</span>
                    </p>
                    <p className="mt-0.5 text-[10px] text-neutral-400">
                      {formatRelative(row.createdAt)}
                    </p>
                  </Td>
                  <Td>
                    {row.images.length === 0 ? (
                      <span className="text-[11px] text-neutral-300">—</span>
                    ) : (
                      <div className="flex -space-x-2">
                        {row.images.slice(0, 3).map((url) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={url}
                            src={url}
                            alt=""
                            className="h-8 w-8 rounded-lg border-2 border-white object-cover"
                          />
                        ))}
                        {row.images.length > 3 ? (
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-white bg-neutral-100 text-[10px] font-semibold text-neutral-500">
                            +{row.images.length - 3}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <StatusPill status={row.status} />
                  </Td>
                  <Td className="text-right">
                    <span className="inline-flex items-center gap-1 text-[13px] text-neutral-500">
                      <ThumbsUp className="h-3 w-3" />
                      {row.helpfulCount}
                    </span>
                  </Td>
                  <Td className="pr-4 lg:pr-3">
                    <div className="flex items-center justify-end gap-0.5">
                      {row.status !== "approved" ? (
                        <form action={setReviewStatusAction}>
                          <input type="hidden" name="reviewId" value={row.id} />
                          <input type="hidden" name="status" value="approved" />
                          <button
                            type="submit"
                            title="Approve"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-emerald-50 hover:text-emerald-600"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </form>
                      ) : null}
                      {row.status !== "rejected" ? (
                        <form action={setReviewStatusAction}>
                          <input type="hidden" name="reviewId" value={row.id} />
                          <input type="hidden" name="status" value="rejected" />
                          <button
                            type="submit"
                            title="Reject"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-amber-50 hover:text-amber-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </form>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setReplyingTo(replyingTo === row.id ? null : row.id)}
                        title="Reply publicly"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-brand"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                      <form action={deleteReviewAction}>
                        <input type="hidden" name="reviewId" value={row.id} />
                        <button
                          type="submit"
                          title="Delete permanently"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    </div>
                  </Td>
                </tr>

                {replyingTo === row.id ? (
                  <tr className="border-b border-neutral-50 bg-neutral-50/70">
                    <td colSpan={9} className="px-4 py-3 lg:px-3">
                      <form
                        action={replyToReviewAction}
                        onSubmit={() => setReplyingTo(null)}
                        className="flex flex-wrap items-end gap-2.5"
                      >
                        <input type="hidden" name="reviewId" value={row.id} />
                        <label className="min-w-[14rem] flex-1">
                          <span className="mb-1.5 block text-[11px] font-medium text-neutral-500">
                            Public reply to {row.customerName}
                          </span>
                          <input
                            name="reply"
                            required
                            maxLength={1000}
                            placeholder="Thanks for the feedback — we're glad it arrived safely."
                            className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                          />
                        </label>
                        <button
                          type="submit"
                          className="h-10 rounded-lg bg-brand px-4 text-[13px] font-semibold text-white transition hover:bg-brand-dark"
                        >
                          Post reply
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplyingTo(null)}
                          className="h-10 px-2 text-[13px] font-medium text-neutral-500 transition hover:text-neutral-800"
                        >
                          Cancel
                        </button>
                      </form>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </>
  );
}
