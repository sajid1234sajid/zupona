/** Uploads to the R2 bucket bound as MEDIA.
 *
 * Database rows only ever store the object *key*; the bytes live in R2. Keys
 * are namespaced by purpose so a bucket lifecycle rule can treat them
 * differently (public product imagery vs. private KYC documents). */

import { getMedia } from "@/lib/db";

export type MediaFolder = "products" | "videos" | "reviews" | "sellers" | "avatars" | "kyc";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Video is capped well under the Workers request-body limit: the upload
 * arrives as one multipart POST through the Worker, so a clip larger than this
 * would be rejected by the platform with a far less helpful error than ours.
 * Product clips are meant to be short demos, not full-length films. */
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

/** Formats a browser can play back from a plain <video src>. MOV is on the
 * list because it is what an iPhone hands over; it is stored as uploaded, and
 * the ones that matter (H.264 in a MOV container) play everywhere the same
 * codec in an MP4 would. */
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
]);

/** KYC paperwork may also be a PDF; product imagery may not. */
const ALLOWED_DOCUMENT_TYPES = new Set([...ALLOWED_IMAGE_TYPES, "application/pdf"]);

function isVideoFolder(folder: MediaFolder): boolean {
  return folder === "videos";
}

export interface UploadResult {
  key: string;
  size: number;
  contentType: string;
}

function extensionFor(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
    "application/pdf": "pdf",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/ogg": "ogv",
    "video/quicktime": "mov",
  };
  return map[contentType] ?? "bin";
}

/** Validates and stores a file. Returns the key to persist on the row.
 *
 * Callers must have already checked that the signed-in user is allowed to
 * write to `ownerId` -- this function does not authorize, only validate. */
export async function uploadMedia(
  file: File,
  folder: MediaFolder,
  ownerId: string
): Promise<UploadResult> {
  if (file.size === 0) throw new Error("File is empty.");

  const video = isVideoFolder(folder);
  const maxBytes = video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    throw new Error(`File is larger than ${maxBytes / 1024 / 1024} MB.`);
  }

  const allowed = video
    ? ALLOWED_VIDEO_TYPES
    : folder === "kyc"
      ? ALLOWED_DOCUMENT_TYPES
      : ALLOWED_IMAGE_TYPES;
  if (!allowed.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || "unknown"}.`);
  }

  const key = `${folder}/${ownerId}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
  const bucket = await getMedia();

  // A video is handed to R2 as the Blob it already is rather than being read
  // into an ArrayBuffer first -- buffering 50 MB would risk the Worker's
  // memory limit, and R2 can consume the body directly.
  await bucket.put(key, video ? file : await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type,
      // Media is content-addressed by a random key, so it never changes once
      // written and can be cached hard.
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: { ownerId, folder },
  });

  return { key, size: file.size, contentType: file.type };
}

/** Stores an upload by streaming it straight into R2.
 *
 * The multipart path above has to hold the whole file in the Worker's memory
 * and spend CPU parsing it, which a phone video is large enough to blow past.
 * Here the request body is handed to R2 as a stream, so the Worker only ever
 * shuttles bytes: no buffering, and almost no CPU regardless of size.
 *
 * Size is taken from Content-Length rather than measured, because measuring
 * would mean draining the stream first -- exactly the buffering this avoids.
 * A client that lies about it only lies about its own upload; R2 stores
 * whatever actually arrives. */
export async function uploadMediaStream(
  body: ReadableStream,
  contentType: string,
  declaredSize: number,
  folder: MediaFolder,
  ownerId: string
): Promise<UploadResult> {
  if (!Number.isFinite(declaredSize) || declaredSize <= 0) {
    throw new Error("Upload is empty.");
  }

  const video = isVideoFolder(folder);
  const maxBytes = video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (declaredSize > maxBytes) {
    throw new Error(`File is larger than ${maxBytes / 1024 / 1024} MB.`);
  }

  const allowed = video
    ? ALLOWED_VIDEO_TYPES
    : folder === "kyc"
      ? ALLOWED_DOCUMENT_TYPES
      : ALLOWED_IMAGE_TYPES;
  if (!allowed.has(contentType)) {
    throw new Error(`Unsupported file type: ${contentType || "unknown"}.`);
  }

  const key = `${folder}/${ownerId}/${crypto.randomUUID()}.${extensionFor(contentType)}`;
  const bucket = await getMedia();

  await bucket.put(key, body, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: { ownerId, folder },
  });

  return { key, size: declaredSize, contentType };
}

/** Fetches a stored object, optionally only part of it.
 *
 * `options` is passed through to R2 so the media route can answer a Range
 * request: browsers ask for byte ranges when scrubbing a <video>, and a server
 * that always replies with the whole file makes seeking impossible. */
export async function getMediaObject(
  key: string,
  options?: R2GetOptions
): Promise<R2ObjectBody | R2Object | null> {
  const bucket = await getMedia();
  return bucket.get(key, options);
}

export async function deleteMedia(key: string): Promise<void> {
  const bucket = await getMedia();
  await bucket.delete(key);
}

/** Lists everything stored for one owner, e.g. all images on a product. */
export async function listMedia(folder: MediaFolder, ownerId: string): Promise<string[]> {
  const bucket = await getMedia();
  const listed = await bucket.list({ prefix: `${folder}/${ownerId}/` });
  return listed.objects.map((object) => object.key);
}

/** Public URL for a stored object.
 *
 * Media is served back through the app's own route rather than a public bucket
 * URL, which keeps private folders (kyc) behind an authorization check and
 * leaves the bucket itself closed to the internet. */
export function mediaUrl(key: string): string {
  return `/api/media/${key}`;
}
