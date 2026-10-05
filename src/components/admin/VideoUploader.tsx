"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Film, Loader2, Play, Star, Trash2, Video } from "lucide-react";
import {
  compressVideo,
  contentTypeOf,
  uploadVideo,
  videoPoster,
  warmVideoTools,
} from "./videoUpload";

interface VideoUploaderProps {
  /** Form field each video URL is posted under, once per clip. */
  name: string;
  /** Parallel field for poster URLs. One value is posted per clip in the same
   * order, empty when no still frame could be made, so the server can zip the
   * two lists back together. */
  posterName: string;
  initialUrls?: string[];
  initialPosters?: string[];
  max?: number;
  label?: string;
  hint?: string;
}

interface Clip {
  url: string;
  poster: string;
}

interface Pending {
  id: number;
  fileName: string;
  /** What is happening to it: shrunk on the phone first, then sent. */
  stage: "waiting" | "shrinking" | "uploading";
  /** 0-100 through the current stage. */
  percent: number;
}

/** Largest file the picker accepts. It is read in place rather than loaded,
 * so this only bounds how long the shrinking takes; what is stored is capped
 * separately, at `MAX_STORED_MB`. */
const MAX_PICKED_MB = 1024;
const MAX_STORED_MB = 200;

/** Posts the poster still and resolves with its URL. The clip itself goes
 * through `uploadVideo`, in pieces. */
function uploadPoster(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/admin/upload?folder=products");
    request.setRequestHeader("content-type", contentTypeOf(file));

    request.onload = () => {
      let payload: { url?: string; error?: string } = {};
      try {
        payload = JSON.parse(request.responseText) as typeof payload;
      } catch {
        /* Not JSON -- handled below. */
      }

      if (request.status >= 200 && request.status < 300 && payload.url) {
        resolve(payload.url);
        return;
      }

      // A reply that is not JSON did not come from the upload handler at all:
      // the platform rejected or killed the request first. Saying so, with the
      // status, is far more use than "could not be uploaded".
      reject(
        new Error(
          payload.error ??
            `Upload rejected by the server (HTTP ${request.status}). ` +
              `Try a shorter clip or a smaller file.`
        )
      );
    };

    request.onerror = () => reject(new Error("Upload failed. Check your connection."));
    request.onabort = () => reject(new Error("Upload cancelled."));

    request.send(file);
  });
}

/** Grabs a still frame from the chosen file to use as the poster image.
 *
 * Done in the browser because a Worker cannot decode video. The frame is taken
 * a second in -- the first frame of a phone recording is usually black. Any
 * failure resolves to null and the clip simply has no poster: it is a nicety,
 * not a requirement. */
function capturePoster(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;

    const finish = (result: File | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      resolve(result);
    };

    // A file the browser cannot decode may never fire an event at all.
    const timer = setTimeout(() => finish(null), 8000);

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        // Capped so the poster stays a thumbnail rather than a second copy of
        // the frame at full recording resolution.
        const scale = Math.min(1, 960 / (video.videoWidth || 960));
        canvas.width = Math.max(1, Math.round((video.videoWidth || 960) * scale));
        canvas.height = Math.max(1, Math.round((video.videoHeight || 540) * scale));

        const context = canvas.getContext("2d");
        if (!context) return finish(null);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => finish(blob ? new File([blob], "poster.jpg", { type: "image/jpeg" }) : null),
          "image/jpeg",
          0.8
        );
      } catch {
        finish(null);
      }
    };

    video.onerror = () => finish(null);
    video.src = objectUrl;
  });
}

/** Video picker for the product form.
 *
 * Mirrors ImageUploader: files go to R2 the moment they are chosen and the
 * form posts back plain URLs, so saving a product never carries tens of
 * megabytes of multipart body. Each clip is shrunk on the phone first and
 * then sent in pieces -- see `videoUpload.ts` -- and the bar shows both
 * stages, because a clip is large enough that silence reads as a hang.
 *
 * Clips are handled one after another, like pictures: two re-encodes at once
 * would fight over the phone's single hardware encoder, and two uploads would
 * split its uplink. */
export default function VideoUploader({
  name,
  posterName,
  initialUrls = [],
  initialPosters = [],
  max = 3,
  label = "Product Videos",
  hint = "MP4 or MOV straight from the phone · shrunk to 720p before it goes up",
}: VideoUploaderProps) {
  const [clips, setClips] = useState<Clip[]>(() =>
    initialUrls.map((url, index) => ({ url, poster: initialPosters[index] ?? "" }))
  );
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
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
    const room = max - clips.length - pending.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));

    if (chosen.length === 0) {
      if (room <= 0) setError(`You can add up to ${max} video${max === 1 ? "" : "s"}.`);
      return;
    }

    setError(null);

    const queued = chosen.map((file) => ({ file, id: nextPendingId.current++ }));
    setPending((current) => [
      ...current,
      ...queued.map(({ file, id }) => ({
        id,
        fileName: file.name,
        stage: "waiting" as const,
        percent: 0,
      })),
    ]);

    const update = (id: number, stage: Pending["stage"], percent: number) => {
      if (!mounted.current) return;
      setPending((current) =>
        current.map((item) => (item.id === id ? { ...item, stage, percent } : item))
      );
    };

    for (const { file, id } of queued) {
      try {
        if (file.size > MAX_PICKED_MB * 1024 * 1024) {
          throw new Error(`"${file.name}" is too long. Trim it to a short clip and try again.`);
        }

        update(id, "shrinking", 0);
        const shrunk = await compressVideo(file, (fraction) =>
          update(id, "shrinking", Math.round(fraction * 100))
        );
        const toSend = shrunk ?? file;

        if (toSend.size > MAX_STORED_MB * 1024 * 1024) {
          throw new Error(
            `"${file.name}" is larger than ${MAX_STORED_MB} MB and this browser cannot shrink it. Trim it to a shorter clip and try again.`
          );
        }

        // From the file actually sent -- after a shrink, the H.264 copy every
        // browser can decode. WebCodecs takes it in a fraction of a second;
        // only where that is unavailable does the slower <video> route run,
        // alongside the upload rather than ahead of it.
        const decoded = await videoPoster(toSend);
        const posterFile = decoded ? Promise.resolve(decoded) : capturePoster(toSend);

        update(id, "uploading", 0);
        const url = await uploadVideo(toSend, (fraction) =>
          update(id, "uploading", Math.round(fraction * 100))
        );

        // A failed poster must not fail the clip -- the video is the point.
        const still = await posterFile;
        const poster = still ? await uploadPoster(still).catch(() => "") : "";

        if (!mounted.current) return;
        setClips((current) => (current.length >= max ? current : [...current, { url, poster }]));
      } catch (uploadError) {
        if (!mounted.current) return;
        setError(
          uploadError instanceof Error ? uploadError.message : "That video could not be uploaded."
        );
      } finally {
        if (mounted.current) {
          setPending((current) => current.filter((item) => item.id !== id));
        }
      }
    }
  };

  const remove = (url: string) => {
    setClips((current) => current.filter((clip) => clip.url !== url));
    setPlaying((current) => (current === url ? null : current));
  };

  const makeFirst = (url: string) =>
    setClips((current) => {
      const found = current.find((clip) => clip.url === url);
      return found ? [found, ...current.filter((clip) => clip.url !== url)] : current;
    });

  const full = clips.length + pending.length >= max;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-neutral-700">{label}</span>
        <span className="text-[11px] text-neutral-400">
          {clips.length}/{max}
        </span>
      </div>

      {clips.map((clip) => (
        <div key={clip.url}>
          <input type="hidden" name={name} value={clip.url} />
          <input type="hidden" name={posterName} value={clip.poster} />
        </div>
      ))}

      <div className="grid gap-2.5 sm:grid-cols-2">
        {clips.map((clip, index) => (
          <div
            key={clip.url}
            className="group relative aspect-video overflow-hidden rounded-xl border border-neutral-200 bg-neutral-900"
          >
            {playing === clip.url ? (
              <video
                src={clip.url}
                poster={clip.poster || undefined}
                controls
                autoPlay
                playsInline
                className="h-full w-full object-contain"
              />
            ) : (
              <button
                type="button"
                onClick={() => setPlaying(clip.url)}
                title="Play this video"
                className="relative block h-full w-full"
              >
                {clip.poster ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={clip.poster} alt="" className="h-full w-full object-cover opacity-80" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-neutral-800">
                    <Film className="h-7 w-7 text-white/40" />
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-lg transition group-hover:scale-105">
                    <Play className="ml-0.5 h-5 w-5 fill-neutral-900 text-neutral-900" />
                  </span>
                </span>
              </button>
            )}

            {index === 0 ? (
              <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-brand px-1.5 py-0.5 text-[9px] font-bold text-white">
                MAIN
              </span>
            ) : null}

            {/* Always visible on a touch screen, which has no hover to reveal
             * them with -- as in ImageUploader. */}
            <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
              {index !== 0 ? (
                <button
                  type="button"
                  onClick={() => makeFirst(clip.url)}
                  title="Show this video first"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-neutral-700 transition hover:bg-white"
                >
                  <Star className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => remove(clip.url)}
                title="Remove this video"
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
            className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4"
          >
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
            <span className="max-w-full truncate text-[11px] text-neutral-500">{item.fileName}</span>
            {item.stage === "waiting" ? (
              <span className="text-[11px] font-medium text-neutral-400">Waiting…</span>
            ) : (
              <>
                <span className="h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-neutral-200">
                  <span
                    className="block h-full rounded-full bg-brand transition-[width] duration-200"
                    style={{ width: `${item.percent}%` }}
                  />
                </span>
                <span className="text-[11px] font-medium text-neutral-400">
                  {item.stage === "shrinking" ? "Shrinking" : "Uploading"} {item.percent}%
                </span>
              </>
            )}
          </div>
        ))}

        {!full ? (
          <label
            htmlFor={inputId}
            onPointerDown={warmVideoTools}
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
            className={`flex aspect-video cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-3 text-center transition ${
              dragging
                ? "border-brand bg-brand-tint"
                : "border-neutral-200 bg-neutral-50 hover:border-brand hover:bg-brand-tint/40"
            }`}
          >
            <Video className="h-5 w-5 text-neutral-400" />
            <span className="text-[11px] font-medium leading-tight text-neutral-500">
              {clips.length === 0 ? "Tap or drag a video" : "Add another video"}
            </span>
          </label>
        ) : null}
      </div>

      <input
        id={inputId}
        type="file"
        // Extensions as well as types: Windows reports no type for some
        // files, and a types-only accept list then hides them in the picker.
        accept="video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.m4v,.webm,.ogv,.mov"
        multiple={max > 1}
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
