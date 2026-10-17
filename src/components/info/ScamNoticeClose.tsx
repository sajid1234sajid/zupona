"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { SCAM_NOTICE_KEY, SCAM_NOTICE_SNOOZE_DAYS } from "./scamNoticeScript";

function hide() {
  document.documentElement.setAttribute("data-scam-note-closed", "");
}

/** The notice's close button. It also repeats the inline script's check on
 * mount, because a script in the page only runs on a full load: after a
 * client-side navigation back to the page, this is what keeps a closed
 * notice closed. */
export default function ScamNoticeClose() {
  useEffect(() => {
    try {
      const closed = Number(localStorage.getItem(SCAM_NOTICE_KEY)) || 0;
      if (closed && Date.now() - closed < SCAM_NOTICE_SNOOZE_DAYS * 864e5) hide();
    } catch {
      // Storage blocked: the notice simply stays.
    }
  }, []);

  return (
    <button
      type="button"
      aria-label="Dismiss"
      onClick={() => {
        try {
          localStorage.setItem(SCAM_NOTICE_KEY, String(Date.now()));
        } catch {
          // Closing still works for this visit.
        }
        hide();
      }}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-white"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
