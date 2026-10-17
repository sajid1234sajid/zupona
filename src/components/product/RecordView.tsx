"use client";

import { useEffect } from "react";
import { recordViewed } from "@/lib/viewedProducts";

/** Notes this product in the browser's viewing history. Draws nothing. */
export default function RecordView({ id, categoryId }: { id: string; categoryId: string | null }) {
  useEffect(() => {
    recordViewed(id, categoryId);
  }, [id, categoryId]);
  return null;
}
