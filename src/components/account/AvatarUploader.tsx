"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle } from "lucide-react";
import AvatarImage from "./AvatarImage";

/** Square-crops a picture to 256px in the browser, so an avatar is a few
 * kilobytes however large the camera made it. */
async function squareCrop(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  canvas
    .getContext("2d")
    ?.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("Could not read that picture.");
  return blob;
}

export default function AvatarUploader({
  avatarUrl,
  name,
  initials,
}: {
  avatarUrl: string | null;
  name: string;
  initials: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(avatarUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError("Choose a JPG, PNG or WebP picture.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", new File([await squareCrop(file)], "avatar.jpg", { type: "image/jpeg" }));
      const response = await fetch("/api/account/avatar", { method: "POST", body: form });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? "Upload failed.");
      setUrl(result.url);
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    await fetch("/api/account/avatar", { method: "DELETE" }).catch(() => null);
    setUrl(null);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-tint text-lg font-bold text-brand-dark">
        {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <AvatarImage src={url} name={name} initials={initials} />}
      </span>
      <div className="flex flex-col gap-1.5">
        <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-brand px-3.5 text-[12.5px] font-bold text-brand-dark hover:bg-brand-mist">
          <Camera className="h-4 w-4" />
          {url ? "Change photo" : "Add a photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {url ? (
          <button type="button" onClick={remove} className="text-left text-[12px] font-semibold text-ink-muted hover:text-accent-red">
            Remove photo
          </button>
        ) : null}
        {error ? <p className="text-[12px] font-semibold text-accent-red">{error}</p> : null}
      </div>
    </div>
  );
}
