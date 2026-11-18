"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { setProductArchivedAction, updateProductAction, type FormState } from "../actions";
import { FormError, ProductFields } from "../fields";

export function ProductForm({
  product,
}: {
  product: { id: string; name: string; brand: string; category: string; archived: boolean };
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateProductAction.bind(null, product.id),
    {},
  );
  const [archiveState, archiveAction, archiving] = useActionState<FormState, FormData>(
    () => setProductArchivedAction(product.id, !product.archived),
    {},
  );

  return (
    <div className="flex flex-col gap-3">
      {product.archived && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">Model đang ẩn — không hiện khi nhập máy và trên website.</p>
      )}
      <form action={formAction} className="flex flex-col gap-3">
        <ProductFields defaults={product} />
        <FormError error={state.error} />
        {state.ok && <p className="text-sm text-emerald-700">Đã lưu</p>}
        <Button type="submit" disabled={pending} className="h-11">
          Lưu model
        </Button>
      </form>
      <form action={archiveAction}>
        <Button type="submit" variant="outline" disabled={archiving} className="w-full">
          {product.archived ? "Hiện lại model" : "Ẩn model"}
        </Button>
        <FormError error={archiveState.error} />
      </form>
    </div>
  );
}
