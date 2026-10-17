"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin";
import { markContactHandled } from "@/lib/supportFeedback";

export async function markHandledAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await markContactHandled(id, staff.id, formData.get("handled") === "1");
  revalidatePath("/admin/customers/messages");
}
