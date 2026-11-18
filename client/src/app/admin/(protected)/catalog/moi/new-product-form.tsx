"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { createProductAction, type FormState } from "../actions";
import { FormError, ProductFields, VariantFields } from "../fields";

export function NewProductForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createProductAction, {});
  const [accessory, setAccessory] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ProductFields />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="accessory"
          checked={accessory}
          onChange={(e) => setAccessory(e.target.checked)}
          className="size-4"
        />
        Phụ kiện (quản lý theo số lượng)
      </label>
      <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Biến thể đầu tiên</legend>
        <VariantFields isSerialized={!accessory} />
      </fieldset>
      <FormError error={state.error} />
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Đang tạo…" : "Tạo model"}
      </Button>
    </form>
  );
}
