"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
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
}

export default function StoreForm({ storeName, description }: StoreFormProps) {
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
        <textarea name="description" rows={5} defaultValue={description} className={textareaStyles} />
      </Field>

      <button type="submit" disabled={pending} className={buttonStyles.primary}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
