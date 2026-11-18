"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatVnd } from "@/lib/money";
import type { VariantDetail } from "@/server/catalog/products";
import {
  adjustStockAction,
  deleteVariantAction,
  setVariantArchivedAction,
  updateVariantAction,
  type FormState,
} from "../actions";
import { FormError, VariantFields } from "../fields";

export function VariantItem({ productId, v }: { productId: string; v: VariantDetail }) {
  const [editing, setEditing] = useState(false);

  const [editState, editAction, saving] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await updateVariantAction(productId, v.id, prev, fd);
    if (r.ok) setEditing(false);
    return r;
  }, {});
  const [archiveState, archiveAction] = useActionState<FormState, FormData>(
    () => setVariantArchivedAction(productId, v.id, !v.archived),
    {},
  );
  const [deleteState, deleteAction] = useActionState<FormState, FormData>(
    () => deleteVariantAction(productId, v.id),
    {},
  );
  const [stockState, stockAction, adjusting] = useActionState<FormState, FormData>(
    adjustStockAction.bind(null, productId, v.id),
    {},
  );

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {v.label}
            {v.archived && <span className="ml-2 text-xs text-muted-foreground">(đã ẩn)</span>}
          </p>
          <p className="text-xs text-muted-foreground">{v.sku}</p>
        </div>
        <div className="text-right text-sm">
          {v.isSerialized ? (
            <>
              <p>Thu: {formatVnd(v.referencePrice)}</p>
              <p className="text-muted-foreground">Mới: {formatVnd(v.newPrice)}</p>
              <p className="text-xs text-muted-foreground">
                {v.listedDeviceCount} đang bán / {v.deviceCount} máy
              </p>
            </>
          ) : (
            <>
              <p>{formatVnd(v.newPrice)}</p>
              <p className="text-muted-foreground">Tồn: {v.stockQty}</p>
            </>
          )}
        </div>
      </div>

      {!v.isSerialized && (
        <form action={stockAction} className="flex flex-wrap items-center gap-2">
          <Input
            name="qty"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            aria-label="Số lượng nhập thêm"
            className="h-10 w-24"
          />
          <Button type="submit" name="op" value="in" size="sm" disabled={adjusting} className="h-10">
            Nhập thêm
          </Button>
          <Button type="submit" name="op" value="out" size="sm" variant="outline" disabled={adjusting} className="h-10">
            Xuất bớt
          </Button>
          <FormError error={stockState.error} />
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing((e) => !e)}>
          {editing ? "Đóng" : "Sửa"}
        </Button>
        <form action={archiveAction}>
          <Button type="submit" size="sm" variant="ghost">
            {v.archived ? "Hiện" : "Ẩn"}
          </Button>
        </form>
        {v.canDelete && (
          <form action={deleteAction}>
            <Button type="submit" size="sm" variant="destructive">
              Xóa
            </Button>
          </form>
        )}
      </div>
      <FormError error={archiveState.error ?? deleteState.error} />

      {editing && (
        <form action={editAction} className="flex flex-col gap-3 border-t pt-3">
          <input type="hidden" name="isSerialized" value={String(v.isSerialized)} />
          <VariantFields defaults={v} isSerialized={v.isSerialized} />
          <FormError error={editState.error} />
          <Button type="submit" disabled={saving} className="h-11">
            Lưu biến thể
          </Button>
        </form>
      )}
    </li>
  );
}
