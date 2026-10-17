"use client";

import { useState } from "react";

/** A profile photo that falls back to the person's initials when there is no
 * photo or it fails to load -- an old pasted link, a photo removed by its
 * host. A plain <img>: an avatar may come from a sign-in provider's host,
 * which the image optimizer would refuse. */
export default function AvatarImage({
  src,
  name,
  initials,
  className = "h-full w-full object-cover",
}: {
  src: string | null;
  name: string;
  initials: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{initials}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={`Profile photo of ${name}`} className={className} onError={() => setFailed(true)} />
  );
}
