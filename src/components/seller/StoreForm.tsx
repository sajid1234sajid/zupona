"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import ImageUploader from "@/components/admin/ImageUploader";
import { updateStoreAction, type StoreFormState } from "@/app/seller/actions";
import {
  Field,
  FormMessage,
  buttonStyles,
  fieldStyles,
  textareaStyles,
} from "@/components/admin/ui";

interface StoreFormProps {
  storeName: string;
  description: string;
  logoUrl: string | null;
  bannerUrl: string | null;
}

export default function StoreForm({ storeName, description, logoUrl, bannerUrl }: StoreFormProps) {
  const [state, formAction, pending] = useActionState<StoreFormState, FormData>(
    updateStoreAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage error={state.error} success={state.success} />

      <Field label="Store name" required>
        <input
          type="text"
          name="storeName"
          required
          minLength={3}
          defaultValue={storeName}
          className={fieldStyles}
        />
      </Field>

      <Field
        label="About your store"
        hint="Shown on your shop page. Say what you sell and why someone should buy from you."
      >
        <textarea
          name="description"
          rows={5}
          maxLength={2000}
          defaultValue={description}
          className={textareaStyles}
        />
      </Field>

      {/* The markers tell the save these pickers were on the form, so an
          emptied picker clears the picture instead of being ignored. */}
      <input type="hidden" name="__present_logo" value="1" />
      <input type="hidden" name="__present_banner" value="1" />
      <div className="grid gap-4 sm:grid-cols-2">
        <ImageUploader
          name="logo"
          folder="sellers"
          max={1}
          label="Store logo"
          hint="Square works best, at least 400 × 400"
          initialUrls={logoUrl ? [logoUrl] : []}
        />
        <ImageUploader
          name="banner"
          folder="sellers"
          max={1}
          label="Store banner"
          hint="Wide picture for the top of your shop page"
          initialUrls={bannerUrl ? [bannerUrl] : []}
        />
      </div>

      <button type="submit" disabled={pending} className={buttonStyles.primary}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
