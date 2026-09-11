"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Star, Trash2, UploadCloud } from "lucide-react";

interface ImageUploaderProps {
  /** Form field the URLs are posted under, once per image. */
  name: string;
  initialUrls?: string[];
  folder?: string;
  max?: number;
  label?: string;
  hint?: string;
  /** Told to the form whenever the gallery changes, so the variant matrix can
   * offer the pictures that actually exist right now rather than the ones the
   * page loaded with. */
  onChange?: (urls: string[]) => void;
}

/** Drag-and-drop image picker that uploads as you go.
 *
 * Files go to R2 through /api/admin/upload the moment they are chosen, and the
 * returned URLs are held in hidden inputs. That means the product form posts
 * plain strings rather than megabytes of multipart body, and a slow upload
 * never blocks the rest of the form.
 *
 * The first image in the list is the primary one -- it is what shows on
 * listing cards -- so it can be promoted rather than only reordered by
 * deleting everything before it. */
export default function ImageUploader({
  name,
  initialUrls = [],
  folder = "products",
  max = 8,
  label = "Product Images",
  hint = "JPG, PNG or WEBP · up to 10 MB each",
  onChange,
}: ImageUploaderProps) {
  const [urls, setUrls] = useState<string[]>(initialUrls);
  // Held in a ref so a parent that passes a fresh closure on every render does
  // not re-fire the notification below.
  const notify = useRef(onChange);
  useEffect(() => {
    notify.current = onChange;
  });

  // Told after the render that produced the new list, so the parent is never
  // asked to update while this component is still rendering.
  useEffect(() => {
    notify.current?.(urls);
  }, [urls]);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const upload = async (files: FileList | File[]) => {
    const room = max - urls.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));

    if (chosen.length === 0) {
      if (room <= 0) setError(`You can add up to ${max} images.`);
      return;
    }

    setError(null);
    setBusy((count) => count + chosen.length);

    await Promise.all(
      chosen.map(async (file) => {
        const body = new FormData();
        body.append("file", file);
        body.append("folder", folder);

        try {
          const response = await fetch("/api/admin/upload", { method: "POST", body });
          const payload = (await response.json()) as { url?: string; error?: string };

          if (!response.ok || !payload.url) {
            setError(payload.error ?? "That image could not be uploaded.");
            return;
          }
          setUrls((current) => (current.length >= max ? current : [...current, payload.url!]));
        } catch {
          setError("Upload failed. Check your connection and try again.");
        } finally {
          setBusy((count) => count - 1);
        }
      })
    );
  };

  const remove = (url: string) => setUrls((current) => current.filter((item) => item !== url));

  const makePrimary = (url: string) =>
    setUrls((current) => [url, ...current.filter((item) => item !== url)]);

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-neutral-700">{label}</span>
        <span className="text-[11px] text-neutral-400">
          {urls.length}/{max}
        </span>
      </div>

      {urls.map((url) => (
        <input key={url} type="hidden" name={name} value={url} />
      ))}

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {urls.map((url, index) => (
          <div
            key={url}
            className="group relative aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />

            {index === 0 ? (
              <span className="absolute left-1.5 top-1.5 rounded-md bg-brand px-1.5 py-0.5 text-[9px] font-bold text-white">
                MAIN
              </span>
            ) : null}

            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
              {index !== 0 ? (
                <button
                  type="button"
                  onClick={() => makePrimary(url)}
                  title="Make this the main image"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-neutral-700 transition hover:bg-white"
                >
                  <Star className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => remove(url)}
                title="Remove this image"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-red-600 transition hover:bg-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}

        {busy > 0
          ? Array.from({ length: busy }, (_, index) => (
              <div
                key={`pending-${index}`}
                className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50"
              >
                <Loader2 className="h-5 w-5 animate-spin text-brand" />
              </div>
            ))
          : null}

        {urls.length + busy < max ? (
          <label
            htmlFor={inputId}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (event.dataTransfer.files.length) void upload(event.dataTransfer.files);
            }}
            className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-2 text-center transition ${
              dragging
                ? "border-brand bg-brand-tint"
                : "border-neutral-200 bg-neutral-50 hover:border-brand hover:bg-brand-tint/40"
            }`}
          >
            {urls.length === 0 ? (
              <UploadCloud className="h-5 w-5 text-neutral-400" />
            ) : (
              <ImagePlus className="h-5 w-5 text-neutral-400" />
            )}
            <span className="text-[10px] font-medium leading-tight text-neutral-500">
              {urls.length === 0 ? "Click or drag images" : "Add more"}
            </span>
          </label>
        ) : null}
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) => {
          if (event.target.files?.length) void upload(event.target.files);
          // Reset so re-picking the same file still fires a change event.
          event.target.value = "";
        }}
      />

      <p className="mt-1.5 text-[11px] text-neutral-400">{hint}</p>
      {error ? <p className="mt-1 text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
