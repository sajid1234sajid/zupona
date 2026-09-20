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

/** Longest edge kept when a picture is re-encoded before upload.
 *
 * The storefront never asks for more: `IMAGE_WIDTHS` in `src/lib/image.ts`
 * tops out at 1440, so anything beyond this is weight nobody downloads. A
 * phone camera hands over 3000-4000 px and six to twelve megabytes of it,
 * which is what made uploading from a phone fail in the first place. */
const MAX_EDGE = 2000;

/** Under this, a file is sent exactly as chosen. Re-encoding a small picture
 * costs a decode and usually makes it no smaller. */
const RECOMPRESS_OVER_BYTES = 400 * 1024;

const QUALITY = 0.85;

/** What the shop can actually display, and therefore what may be sent
 * unchanged. HEIC -- what an iPhone stores by default -- is deliberately not
 * here: no browser paints it and the Images binding will not transform it, so
 * it has to be re-encoded on this side or refused with an explanation. */
const DISPLAYABLE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

const QUEUED = -2;
const RESIZING = -1;

interface Pending {
  id: number;
  name: string;
  /** 0-100 bytes-sent progress, or one of the two states before that:
   * QUEUED while earlier files are still going up, RESIZING while this one is
   * being re-encoded. */
  percent: number;
}

/** Decodes, shrinks and re-encodes a chosen picture.
 *
 * This is the whole reason uploading from a phone works now. A camera JPEG is
 * several megabytes, and pushing it through `FormData` meant the Worker had to
 * buffer and parse the lot while a phone on mobile data held the connection
 * open long enough to drop it -- which surfaced as "check your connection",
 * because a request that dies mid-flight is indistinguishable from one. Shrunk
 * here first, the same photograph goes up as a couple of hundred kilobytes.
 *
 * Every file is decoded first, even one small enough to send untouched. The
 * decode is what proves it is a picture at all: the server can only check the
 * type the browser guessed from the file name, so a renamed document used to
 * be stored happily and show up in the catalogue as a broken thumbnail. What
 * this side cannot paint, the shop cannot paint either.
 *
 * Returns the original file when it is already small enough, and throws with
 * something the admin can act on when it is not a usable picture. */
async function shrink(file: File): Promise<Blob> {
  // An animated GIF would come back from a canvas as a single still frame, so
  // it is never re-encoded; it stands or falls at its own size.
  if (file.type === "image/gif") return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    bitmap = await decodeWithImgElement(file).catch(() => null);
  }

  if (!bitmap) {
    throw new Error(
      file.type === "image/heic" || file.type === "image/heif" || /\.heic$/i.test(file.name)
        ? "This photo is in HEIC format, which browsers cannot show. On iPhone: Settings › Camera › Formats › Most Compatible, then take the photo again."
        : `"${file.name}" is not a picture the shop can show.`
    );
  }

  try {
    const displayable = DISPLAYABLE.has(file.type);
    const withinSize = Math.max(bitmap.width, bitmap.height) <= MAX_EDGE;

    // Small, already a servable format and no bigger than the shop ever asks
    // for: nothing to gain from a second encode.
    if (displayable && withinSize && file.size <= RECOMPRESS_OVER_BYTES) return file;

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      if (displayable) return file;
      throw new Error(`"${file.name}" could not be read.`);
    }
    context.drawImage(bitmap, 0, 0, width, height);

    // WebP first for the size, but an older Safari quietly answers a
    // `toBlob("image/webp")` with a PNG -- which would be larger than what was
    // chosen -- so the type that comes back is checked rather than trusted.
    let encoded = await toBlob(canvas, "image/webp");
    if (!encoded || encoded.type !== "image/webp") {
      encoded = await toBlob(canvas, "image/jpeg");
    }

    if (!encoded) {
      if (displayable) return file;
      throw new Error(`"${file.name}" could not be read.`);
    }

    // A picture already smaller than anything we would produce keeps its own
    // bytes, as long as it is a format the shop can serve and a size it can
    // afford to send.
    return displayable && withinSize && encoded.size >= file.size ? file : encoded;
  } finally {
    bitmap.close();
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/** `createImageBitmap` is missing on older iOS Safari; an `<img>` decodes the
 * same formats there. */
function decodeWithImgElement(file: File): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = async () => {
      try {
        resolve(await createImageBitmap(image));
      } catch {
        reject(new Error("decode failed"));
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("decode failed"));
    };
    image.src = objectUrl;
  });
}

/** Sends one prepared picture and resolves with the stored URL.
 *
 * Posted as a raw body rather than multipart, exactly as the video picker
 * does: the Worker then streams the bytes straight into R2 instead of parsing
 * a multipart envelope, which is both the CPU cost and the failure mode that
 * made a large photograph unreliable.
 *
 * XMLHttpRequest rather than fetch for `upload.onprogress` -- fetch still
 * cannot report how much of a request body has gone out, and on mobile data a
 * bar that does not move reads as a hang. */
function put(
  blob: Blob,
  folder: string,
  onProgress: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `/api/admin/upload?folder=${encodeURIComponent(folder)}`);
    request.setRequestHeader("content-type", blob.type || "image/jpeg");

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        // Held under 100 until the server answers: bytes sent is not the same
        // thing as the object being stored.
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };

    request.onload = () => {
      let payload: { url?: string; error?: string } = {};
      try {
        payload = JSON.parse(request.responseText) as typeof payload;
      } catch {
        /* Not JSON -- handled below. */
      }

      if (request.status >= 200 && request.status < 300 && payload.url) {
        onProgress(100);
        resolve(payload.url);
        return;
      }

      // A reply that is not JSON never reached the upload handler: the
      // platform rejected or killed the request first. Saying so, with the
      // status, beats a blanket "could not be uploaded".
      reject(
        new Error(
          payload.error ??
            (request.status === 403
              ? "Your session has expired. Sign in again and retry."
              : `The server refused the upload (HTTP ${request.status || "no reply"}).`)
        )
      );
    };

    request.onerror = () => reject(new Error("network"));
    request.ontimeout = () => reject(new Error("network"));
    request.onabort = () => reject(new Error("network"));

    request.send(blob);
  });
}

/** One retry, because a phone handing the radio between towers drops a request
 * that would have succeeded a second later. */
async function putWithRetry(
  blob: Blob,
  folder: string,
  onProgress: (percent: number) => void
): Promise<string> {
  try {
    return await put(blob, folder, onProgress);
  } catch (error) {
    if (error instanceof Error && error.message !== "network") throw error;
    onProgress(0);
    try {
      return await put(blob, folder, onProgress);
    } catch (retryError) {
      throw retryError instanceof Error && retryError.message === "network"
        ? new Error("Upload failed — the connection dropped. Try again on a steadier signal.")
        : retryError;
    }
  }
}

/** Drag-and-drop image picker that uploads as you go.
 *
 * Files are shrunk in the browser and sent to R2 through /api/admin/upload the
 * moment they are chosen, and the returned URLs are held in hidden inputs.
 * That means the product form posts plain strings rather than megabytes of
 * multipart body, and a slow upload never blocks the rest of the form.
 *
 * Pictures go up one at a time. Eight at once split a phone's uplink eight
 * ways, so every one of them crawled and the slowest tended to be dropped;
 * in a queue each finishes at full speed and the admin watches them land.
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
  hint = "JPG, PNG or WEBP · any size, the phone shrinks it first",
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
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputId = useId();
  const nextPendingId = useRef(0);

  // A form navigated away from mid-upload should not leave a state setter
  // firing on an unmounted tree.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const upload = async (files: FileList | File[]) => {
    const room = max - urls.length - pending.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));

    if (chosen.length === 0) {
      if (room <= 0) setError(`You can add up to ${max} image${max === 1 ? "" : "s"}.`);
      return;
    }

    setError(null);

    const queued = chosen.map((file) => ({ file, id: nextPendingId.current++ }));
    setPending((current) => [
      ...current,
      ...queued.map(({ file, id }) => ({ id, name: file.name, percent: QUEUED })),
    ]);

    // Sequential on purpose -- see the note on the component.
    for (const { file, id } of queued) {
      try {
        setPending((current) =>
          current.map((item) => (item.id === id ? { ...item, percent: RESIZING } : item))
        );
        const prepared = await shrink(file);
        const url = await putWithRetry(prepared, folder, (percent) => {
          if (!mounted.current) return;
          setPending((current) =>
            current.map((item) => (item.id === id ? { ...item, percent } : item))
          );
        });

        if (!mounted.current) return;
        setUrls((current) => (current.length >= max ? current : [...current, url]));
      } catch (uploadError) {
        if (!mounted.current) return;
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "That image could not be uploaded."
        );
      } finally {
        if (mounted.current) {
          setPending((current) => current.filter((item) => item.id !== id));
        }
      }
    }
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

            {/* Always visible on a touch screen, which has no hover to reveal
             * them with -- the delete button was unreachable on a phone. */}
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
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

        {pending.map((item) => (
          <div
            key={`pending-${item.id}`}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-2"
          >
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
            {item.percent < 0 ? (
              <span className="text-[10px] font-medium text-neutral-400">
                {item.percent === QUEUED ? "Waiting…" : "Resizing…"}
              </span>
            ) : (
              <>
                <span className="h-1.5 w-full max-w-[72px] overflow-hidden rounded-full bg-neutral-200">
                  <span
                    className="block h-full rounded-full bg-brand transition-[width] duration-200"
                    style={{ width: `${item.percent}%` }}
                  />
                </span>
                <span className="text-[10px] font-medium text-neutral-400">{item.percent}%</span>
              </>
            )}
          </div>
        ))}

        {urls.length + pending.length < max ? (
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
              {urls.length === 0 ? "Tap to add images" : "Add more"}
            </span>
          </label>
        ) : null}
      </div>

      <input
        id={inputId}
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
      {error ? <p className="mt-1 text-[11px] leading-snug text-red-600">{error}</p> : null}
    </div>
  );
}
