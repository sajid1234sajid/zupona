"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles, Star, Trash2, Undo2, UploadCloud } from "lucide-react";
import {
  composeWithFill,
  encodeForWeb,
  fitWithBlur,
  needsFitting,
  prepareForAi,
  PRODUCT_RATIO,
} from "../../../apps/image-fit/shared/fit";

/** What happens to a picture whose shape is not the shop's 4:5 frame. Chosen
 * in Settings; see `image_autofit`. */
export type AutoFitMode = "off" | "blur" | "ai";

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
  /** Fit pictures to the product frame as they go up. Only the product form
   * passes this; category art and banners have shapes of their own. */
  autoFit?: AutoFitMode;
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
const FITTING = -3;

interface Pending {
  id: number;
  name: string;
  /** 0-100 bytes-sent progress, or one of the states before that: QUEUED
   * while earlier files are still going up, RESIZING while this one is being
   * re-encoded, FITTING while it is being fitted to the frame. */
  percent: number;
}

/** A picture ready to go up, with the pixel size the upload route writes into
 * its key. Null for a GIF, which is never decoded. */
interface Prepared {
  blob: Blob;
  width: number | null;
  height: number | null;
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
async function shrink(file: File): Promise<Prepared> {
  // An animated GIF would come back from a canvas as a single still frame, so
  // it is never re-encoded; it stands or falls at its own size.
  if (file.type === "image/gif") return { blob: file, width: null, height: null };

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
    const own = { width: bitmap.width, height: bitmap.height };
    if (displayable && withinSize && file.size <= RECOMPRESS_OVER_BYTES) {
      return { blob: file, ...own };
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      if (displayable) return { blob: file, ...own };
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
      if (displayable) return { blob: file, ...own };
      throw new Error(`"${file.name}" could not be read.`);
    }

    // A picture already smaller than anything we would produce keeps its own
    // bytes, as long as it is a format the shop can serve and a size it can
    // afford to send.
    return displayable && withinSize && encoded.size >= file.size
      ? { blob: file, ...own }
      : { blob: encoded, width, height };
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

/** Fits a prepared picture to the product frame, or returns null when it is
 * already the right shape.
 *
 * Nothing is cropped: the picture goes in whole and only the space around it
 * is filled -- by the AI when asked, otherwise with a blurred copy of the
 * picture. The AI answers through /api/admin/image-fit, which reaches the
 * Zupona Image Fit Worker over a service binding. When it cannot help (the
 * day's allowance spent, an outage) the blurred fill is used instead and the
 * admin is told, rather than the upload failing. */
async function fitToFrame(
  prepared: Prepared,
  mode: AutoFitMode
): Promise<{ fitted: Prepared; notice: string | null } | null> {
  if (mode === "off" || prepared.width === null || prepared.height === null) return null;
  if (!needsFitting(prepared.width, prepared.height, PRODUCT_RATIO)) return null;

  const bitmap = await createImageBitmap(prepared.blob);
  try {
    let canvas: HTMLCanvasElement | null = null;
    let notice: string | null = null;

    if (mode === "ai") {
      try {
        const request = await prepareForAi(bitmap, bitmap.width, bitmap.height, PRODUCT_RATIO);
        const form = new FormData();
        form.append("image", request.image, "picture.jpg");
        form.append("width", String(request.width));
        form.append("height", String(request.height));
        const response = await fetch("/api/admin/image-fit", { method: "POST", body: form });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? `HTTP ${response.status}`);
        }
        const fill = await createImageBitmap(await response.blob());
        try {
          canvas = composeWithFill(fill, bitmap, bitmap.width, bitmap.height, PRODUCT_RATIO);
        } finally {
          fill.close();
        }
      } catch (error) {
        notice = `AI fill was unavailable (${
          error instanceof Error ? error.message : "no reply"
        }), so the blurred fill was used instead.`;
      }
    }

    canvas ??= fitWithBlur(bitmap, bitmap.width, bitmap.height, PRODUCT_RATIO);
    const blob = await encodeForWeb(canvas);
    return { fitted: { blob, width: canvas.width, height: canvas.height }, notice };
  } finally {
    bitmap.close();
  }
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
  prepared: Prepared,
  folder: string,
  onProgress: (percent: number) => void
): Promise<string> {
  const { blob, width, height } = prepared;
  // The measured size rides along so the upload route can write it into the
  // key; see `dimensionsFromUrl()`.
  const size = width && height ? `&w=${width}&h=${height}` : "";
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `/api/admin/upload?folder=${encodeURIComponent(folder)}${size}`);
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
  prepared: Prepared,
  folder: string,
  onProgress: (percent: number) => void
): Promise<string> {
  try {
    return await put(prepared, folder, onProgress);
  } catch (error) {
    if (error instanceof Error && error.message !== "network") throw error;
    onProgress(0);
    try {
      return await put(prepared, folder, onProgress);
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
  autoFit = "off",
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
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  /** The unfitted version of every picture fitted during this visit, so the
   * admin can put the original back if the fill did not come out well. */
  const originals = useRef(new Map<string, Prepared>());
  const [restoring, setRestoring] = useState<string | null>(null);
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
    setNotice(null);

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

        if (autoFit !== "off") {
          setPending((current) =>
            current.map((item) => (item.id === id ? { ...item, percent: FITTING } : item))
          );
        }
        // A fit that fails outright is not worth losing the upload over: the
        // picture goes up as chosen.
        const fit = await fitToFrame(prepared, autoFit).catch(() => null);
        if (fit?.notice && mounted.current) setNotice(fit.notice);

        const url = await putWithRetry(fit?.fitted ?? prepared, folder, (percent) => {
          if (!mounted.current) return;
          setPending((current) =>
            current.map((item) => (item.id === id ? { ...item, percent } : item))
          );
        });

        if (!mounted.current) return;
        if (fit) originals.current.set(url, prepared);
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

  /** Swaps a fitted picture for the one the admin actually chose, in the same
   * place in the gallery. */
  const restoreOriginal = async (url: string) => {
    const original = originals.current.get(url);
    if (!original || restoring) return;
    setRestoring(url);
    setError(null);
    try {
      const restored = await putWithRetry(original, folder, () => {});
      if (!mounted.current) return;
      originals.current.delete(url);
      setUrls((current) => current.map((item) => (item === url ? restored : item)));
    } catch (restoreError) {
      if (mounted.current) {
        setError(
          restoreError instanceof Error
            ? restoreError.message
            : "The original could not be restored."
        );
      }
    } finally {
      if (mounted.current) setRestoring(null);
    }
  };

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

            {originals.current.has(url) ? (
              <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-brand-dark">
                <Sparkles className="h-2.5 w-2.5" />
                FITTED
              </span>
            ) : null}

            {/* Always visible on a touch screen, which has no hover to reveal
             * them with -- the delete button was unreachable on a phone. */}
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
              {originals.current.has(url) ? (
                <button
                  type="button"
                  onClick={() => void restoreOriginal(url)}
                  disabled={restoring !== null}
                  title="Use the original picture instead"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-neutral-700 transition hover:bg-white disabled:opacity-50"
                >
                  {restoring === url ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Undo2 className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : null}
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
                {item.percent === QUEUED
                  ? "Waiting…"
                  : item.percent === FITTING
                    ? autoFit === "ai"
                      ? "AI fitting…"
                      : "Fitting…"
                    : "Resizing…"}
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

      <p className="mt-1.5 text-[11px] text-neutral-400">
        {hint}
        {autoFit !== "off"
          ? ` · Pictures that are not 4:5 are fitted to the product frame with ${
              autoFit === "ai" ? "AI-painted" : "blurred"
            } surroundings. Nothing is cropped, and ↶ puts the original back.`
          : ""}
      </p>
      {notice ? <p className="mt-1 text-[11px] leading-snug text-amber-700">{notice}</p> : null}
      {error ? <p className="mt-1 text-[11px] leading-snug text-red-600">{error}</p> : null}
    </div>
  );
}
