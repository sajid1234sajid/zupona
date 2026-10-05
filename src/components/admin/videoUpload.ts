/** Getting a product video from a phone into R2 quickly and reliably.
 *
 * Two things made it slow and fragile. A phone records at 1080p or 4K and
 * 15-30 Mbit/s, so a half-minute clip is 50-100 MB -- over the old 50 MB cap,
 * and minutes of upload on mobile data. And it went up as one request, so a
 * single dropped connection threw the whole clip away.
 *
 * `compressVideo` re-encodes the clip in the browser to 720p H.264 at a
 * bitrate a product demo needs, using the phone's hardware encoder through
 * WebCodecs; the same clip comes out a tenth of the size, and H.264 also plays
 * everywhere, which an iPhone's HEVC does not. `uploadVideo` then sends it in
 * pieces, a few at a time, resending any piece the line drops.
 *
 * Compression is a speed-up, never a requirement: when the browser cannot do
 * it, or it would drop the sound, the original goes up instead. */

/** Longest edge of the re-encoded clip. The product page never shows video
 * larger than this, and it is what keeps a clip small. */
const MAX_EDGE = 1280;
const VIDEO_BITRATE = 2_500_000;
const AUDIO_BITRATE = 128_000;

/** Below this, an MP4 is already cheap to send and is left as it is. */
const COMPRESS_OVER_BYTES = 6 * 1024 * 1024;

/** Must match `VIDEO_PART_BYTES` in `src/lib/media.ts`. */
const PART_BYTES = 8 * 1024 * 1024;
const PARALLEL_PARTS = 3;
const PART_ATTEMPTS = 5;

/** Windows and some Android pickers hand over a file with an empty `type`; the
 * extension is all there is to go on then. */
export function contentTypeOf(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  const byExtension: Record<string, string> = {
    mp4: "video/mp4",
    m4v: "video/mp4",
    webm: "video/webm",
    ogv: "video/ogg",
    mov: "video/quicktime",
    qt: "video/quicktime",
  };
  return byExtension[extension ?? ""] ?? "application/octet-stream";
}

/** A shrink that would take longer than this is abandoned and the original
 * sent instead -- on a phone without a hardware encoder the "speed-up" could
 * otherwise cost more than it saves. Judged from the first few seconds. */
const MAX_SHRINK_MS = 180_000;
const JUDGE_AFTER_MS = 12_000;

/** Starts fetching the encoder code before it is needed. Called when the
 * admin taps the picker: choosing a clip takes seconds, and that is enough to
 * have it ready instead of loading it after the pick. */
export function warmVideoTools(): void {
  void import("mediabunny").catch(() => {});
}

function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

/** Re-encodes a clip to 720p H.264 MP4. Resolves with the smaller file, or
 * null when the original should be sent as it is. Never throws. */
export async function compressVideo(
  file: File,
  onProgress: (fraction: number) => void
): Promise<File | null> {
  const type = contentTypeOf(file);
  if (type === "video/mp4" && file.size <= COMPRESS_OVER_BYTES) return null;
  if (typeof window === "undefined" || !("VideoEncoder" in window)) return null;

  let dispose: (() => void) | null = null;
  try {
    // Loaded only when a video is actually chosen, so neither the admin form
    // nor anything else pays for it up front.
    const {
      ALL_FORMATS,
      BlobSource,
      BufferTarget,
      Conversion,
      Input,
      Mp4OutputFormat,
      Output,
      Quality,
    } = await import("mediabunny");

    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
    dispose = () => input.dispose();

    const track = await input.getPrimaryVideoTrack();
    if (!track) return null;

    const scale = Math.min(1, MAX_EDGE / Math.max(track.displayWidth, track.displayHeight));
    const target = new BufferTarget();
    const output = new Output({
      // Index at the front, so the product page can start playing before the
      // whole file has arrived.
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target,
    });

    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: {
        width: even(track.displayWidth * scale),
        height: even(track.displayHeight * scale),
        fit: "contain",
        codec: "avc",
        quality: new Quality({ bitrate: VIDEO_BITRATE }),
      },
      audio: { codec: "aac", quality: new Quality({ bitrate: AUDIO_BITRATE }) },
      showWarnings: false,
    });

    // A clip that would come out silent or without its picture is not worth
    // the saving: older iPhones, for one, cannot encode AAC.
    if (!conversion.isValid || conversion.discardedTracks.length > 0) return null;

    const started = performance.now();
    let done = 0;
    conversion.onProgress = (fraction) => {
      done = Math.min(1, Math.max(0, fraction));
      onProgress(done);
    };
    const watchdog = setInterval(() => {
      const elapsed = performance.now() - started;
      if (elapsed < JUDGE_AFTER_MS) return;
      const projected = done > 0 ? elapsed / done : Infinity;
      if (projected > MAX_SHRINK_MS) void conversion.cancel();
    }, 1000);
    try {
      await conversion.execute();
    } finally {
      clearInterval(watchdog);
    }
    if (conversion.state !== "done") return null;

    const buffer = target.buffer;
    if (!buffer || buffer.byteLength === 0) return null;

    // An MP4 that was already lean keeps its own bytes. Anything else (an
    // iPhone MOV, usually HEVC) takes the H.264 copy even at the same size,
    // because that is the one every shopper's browser can play.
    if (type === "video/mp4" && buffer.byteLength >= file.size * 0.9) return null;

    const name = file.name.replace(/\.[^.]+$/, "") + ".mp4";
    return new File([buffer], name, { type: "video/mp4" });
  } catch {
    return null;
  } finally {
    dispose?.();
  }
}

/** A still frame for the clip's poster, decoded with WebCodecs.
 *
 * Preferred over seeking a <video> element: that route was slow to settle
 * and, run beside an upload, slowed the upload too, while this decodes one
 * frame in well under a second. Taken a second in -- the first frame of a
 * phone recording is usually black. Null when this browser cannot decode the
 * clip; the caller then falls back to the element. */
export async function videoPoster(file: File): Promise<File | null> {
  if (typeof window === "undefined" || !("VideoDecoder" in window)) return null;

  let dispose: (() => void) | null = null;
  try {
    const { ALL_FORMATS, BlobSource, CanvasSink, Input } = await import("mediabunny");
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
    dispose = () => input.dispose();

    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) return null;

    // Capped so the poster stays a thumbnail rather than a second copy of the
    // frame at full resolution.
    const scale = Math.min(1, 960 / Math.max(track.displayWidth, track.displayHeight));
    const sink = new CanvasSink(track, {
      width: even(track.displayWidth * scale),
      height: even(track.displayHeight * scale),
      fit: "contain",
    });
    const duration = await track.computeDuration();
    const frame = await sink.getCanvas(Math.min(1, (duration || 2) / 2));
    if (!frame) return null;

    const { canvas } = frame;
    const blob =
      "convertToBlob" in canvas
        ? await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 })
        : await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", 0.8)
          );
    return blob ? new File([blob], "poster.jpg", { type: "image/jpeg" }) : null;
  } catch {
    return null;
  } finally {
    dispose?.();
  }
}

class UploadError extends Error {
  constructor(
    message: string,
    /** False for a refusal the server gave on purpose; resending will not help. */
    readonly retryable: boolean
  ) {
    super(message);
  }
}

/** One request with body progress. XMLHttpRequest rather than fetch because
 * fetch still cannot report how much of a request body has gone out. */
function send<T>(
  url: string,
  body: Blob | string,
  contentType: string,
  onProgress?: (loaded: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.setRequestHeader("content-type", contentType);
    // A stalled piece is abandoned and resent rather than waited on forever.
    request.timeout = 120_000;

    if (onProgress) {
      request.upload.onprogress = (event) => onProgress(event.loaded);
    }

    request.onload = () => {
      let payload: (T & { error?: string }) | null = null;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        /* Not JSON: the platform answered, not the handler. */
      }
      if (request.status >= 200 && request.status < 300 && payload) {
        resolve(payload);
        return;
      }
      if (request.status === 403) {
        reject(new UploadError("Your session has expired. Sign in again and retry.", false));
        return;
      }
      // A handler's own 4xx is final; anything else (5xx, a platform page) is
      // worth another try.
      const handled = payload?.error && request.status >= 400 && request.status < 500;
      reject(
        new UploadError(
          payload?.error ?? `The server refused the upload (HTTP ${request.status}).`,
          !handled
        )
      );
    };

    const dropped = () => reject(new UploadError("network", true));
    request.onerror = dropped;
    request.ontimeout = dropped;
    request.onabort = dropped;

    request.send(body);
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(attempt: () => Promise<T>, onRetry?: () => void): Promise<T> {
  for (let tries = 1; ; tries++) {
    try {
      return await attempt();
    } catch (error) {
      const retryable = !(error instanceof UploadError) || error.retryable;
      if (!retryable || tries >= PART_ATTEMPTS) {
        throw error instanceof UploadError && error.message === "network"
          ? new Error("Upload failed — the connection kept dropping. Try again on a steadier signal.")
          : error;
      }
      onRetry?.();
      // A phone moving between towers needs a moment, not an instant retry.
      await wait(Math.min(8000, 1000 * 2 ** (tries - 1)));
    }
  }
}

/** Stores a video and resolves with its URL. `onProgress` gets 0-1 of the
 * bytes sent, held just under 1 until the server confirms the object. */
export async function uploadVideo(
  file: File,
  onProgress: (fraction: number) => void
): Promise<string> {
  const type = contentTypeOf(file);

  // One piece's worth goes up as one request, as images do.
  if (file.size <= PART_BYTES) {
    const result = await withRetry(
      () =>
        send<{ url: string }>(
          "/api/admin/upload?folder=videos",
          file,
          type,
          (loaded) => onProgress(Math.min(0.99, loaded / file.size))
        ),
      () => onProgress(0)
    );
    return result.url;
  }

  const base = "/api/admin/upload/video";
  const { key, uploadId } = await withRetry(() =>
    send<{ key: string; uploadId: string }>(
      `${base}?step=start`,
      JSON.stringify({ contentType: type, size: file.size }),
      "application/json"
    )
  );

  const count = Math.ceil(file.size / PART_BYTES);
  const sent = new Array<number>(count).fill(0);
  const report = () =>
    onProgress(Math.min(0.99, sent.reduce((sum, bytes) => sum + bytes, 0) / file.size));

  const parts: { partNumber: number; etag: string }[] = [];
  let next = 0;
  // Once one piece has given up, the others stop taking new ones.
  let failed = false;

  const worker = async () => {
    while (!failed && next < count) {
      const index = next++;
      const piece = file.slice(index * PART_BYTES, Math.min(file.size, (index + 1) * PART_BYTES));
      const query = new URLSearchParams({ step: "part", key, uploadId, part: String(index + 1) });
      const part = await withRetry(
        () =>
          send<{ partNumber: number; etag: string }>(
            `${base}?${query}`,
            piece,
            "application/octet-stream",
            (loaded) => {
              sent[index] = loaded;
              report();
            }
          ),
        () => {
          sent[index] = 0;
          report();
        }
      ).catch((error) => {
        failed = true;
        throw error;
      });
      sent[index] = piece.size;
      report();
      parts.push({ partNumber: part.partNumber, etag: part.etag });
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, count) }, worker));
    const result = await withRetry(() =>
      send<{ url: string }>(
        `${base}?step=finish`,
        JSON.stringify({ key, uploadId, parts }),
        "application/json"
      )
    );
    return result.url;
  } catch (error) {
    // Unfinished pieces would otherwise sit in the bucket until R2 expires them.
    void send(`${base}?step=abort`, JSON.stringify({ key, uploadId }), "application/json").catch(
      () => {}
    );
    throw error;
  }
}
