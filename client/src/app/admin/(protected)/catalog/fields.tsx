"use client";

import { useId } from "react";
import { MoneyInput } from "@/components/money-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_LABEL, PRODUCT_CATEGORIES } from "@/server/catalog/schemas";

function TextField({ label, name, defaultValue, required }: { label: string; name: string; defaultValue?: string | null; required?: boolean }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} defaultValue={defaultValue ?? ""} required={required} className="h-11 text-base" />
    </div>
  );
}

export function ProductFields({
  defaults,
}: {
  defaults?: { name: string; brand: string; category: string };
}) {
  const id = useId();
  return (
    <>
      <TextField label="Tên model" name="name" defaultValue={defaults?.name} required />
      <TextField label="Hãng" name="brand" defaultValue={defaults?.brand} required />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>Loại</Label>
        <select
          id={id}
          name="category"
          defaultValue={defaults?.category ?? "PHONE"}
          className="h-11 rounded-lg border border-input bg-background px-3 text-base"
        >
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

export type VariantDefaults = {
  storage?: string | null;
  ram?: string | null;
  color?: string | null;
  referencePrice?: bigint | null;
  newPrice?: bigint | null;
};

export function VariantFields({ defaults, isSerialized = true }: { defaults?: VariantDefaults; isSerialized?: boolean }) {
  return (
    <>
      {isSerialized && (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Dung lượng" name="storage" defaultValue={defaults?.storage} />
          <TextField label="RAM" name="ram" defaultValue={defaults?.ram} />
        </div>
      )}
      <TextField label="Màu" name="color" defaultValue={defaults?.color} />
      {isSerialized && (
        <MoneyInput name="referencePrice" label="Giá tham chiếu thu" defaultValue={defaults?.referencePrice} />
      )}
      <MoneyInput name="newPrice" label="Giá máy mới / giá bán" defaultValue={defaults?.newPrice} />
    </>
  );
}

export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  );
}
