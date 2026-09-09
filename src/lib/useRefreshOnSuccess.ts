"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * After a useActionState action reports success, refreshes the current route's
 * server data and only THEN calls onDone() - calling both at once would let
 * onDone() flip a parent view back before the refreshed props arrive, showing
 * a stale (e.g. still-empty) list for a moment.
 */
export function useRefreshOnSuccess(success: boolean | undefined, onDone: () => void): void {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const handled = useRef(false);

  useEffect(() => {
    if (success && !handled.current) {
      handled.current = true;
      startRefresh(() => {
        router.refresh();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  useEffect(() => {
    if (handled.current && !refreshing) {
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshing]);
}
