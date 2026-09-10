"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Full-screen playback for a product clip.
 *
 * Native controls rather than a custom bar: the platform's are keyboard
 * accessible, understand captions and scrubbing, and behave the way the
 * shopper's phone already does. Autoplay is muted, because a clip that starts
 * talking in a quiet room is the fastest way to lose a sale -- the shopper can
 * unmute from the controls.
 *
 * Escape closes, focus moves to the close button on open and the page behind
 * is frozen, so a modal cannot be scrolled out from under. */
export default function VideoModal({
  src,
  poster,
  title,
  onClose,
}: {
  src: string;
  poster: string;
  title: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} video`}
      className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        aria-label="Close video"
        onClick={onClose}
        className="fixed right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white text-heading shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Stops a click inside the player from closing the dialog. */}
      <div
        className="w-full max-w-[720px] overflow-hidden rounded-2xl bg-black"
        onClick={(event) => event.stopPropagation()}
      >
        <video
          src={src}
          poster={poster}
          controls
          autoPlay
          muted
          playsInline
          className="block max-h-[80vh] w-full"
        />
      </div>
    </div>
  );
}
