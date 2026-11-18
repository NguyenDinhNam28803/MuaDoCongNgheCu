"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { addVariantAction, type FormState } from "../actions";
import { FormError, VariantFields } from "../fields";

export function AddVariantForm({ productId, isSerialized }: { productId: string; isSerialized: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addVariantAction.bind(null, productId),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="isSerialized" value={String(isSerialized)} />
      <VariantFields isSerialized={isSerialized} />
      <FormError error={state.error} />
      <Button type="submit" disabled={pending} className="h-11">
        Thêm biến thể
      </Button>
    </form>
  );
}
