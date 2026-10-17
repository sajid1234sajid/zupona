"use server";

import { revalidatePath } from "next/cache";
import { invalidatePrefix } from "@/lib/cache";
import { logAdminAction, requireAdmin, setSetting } from "@/lib/admin";
import { POPULAR_SEARCHES_SETTING } from "@/lib/searchInsights";

export interface PopularFormState {
  error?: string;
  success?: string;
}

/** Saves the admin's own "Popular right now" list: one search per line, at
 * most twelve. An empty list hands the panel back to real search traffic. */
export async function savePopularSearches(
  _prev: PopularFormState,
  form: FormData
): Promise<PopularFormState> {
  const admin = await requireAdmin();
  const lines = String(form.get("popular") ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().slice(0, 60))
    .filter(Boolean);
  const unique = [...new Set(lines)].slice(0, 12);

  await setSetting(POPULAR_SEARCHES_SETTING, unique.join("\n"));
  await invalidatePrefix("search:popular");
  await logAdminAction(admin.id, "settings.popular_searches", "setting", POPULAR_SEARCHES_SETTING);
  revalidatePath("/admin/reports/search");

  return {
    success: unique.length
      ? `Saved ${unique.length} popular search${unique.length === 1 ? "" : "es"}.`
      : "Cleared. Popular searches now come from what shoppers search most.",
  };
}
