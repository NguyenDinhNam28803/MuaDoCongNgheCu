"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShopInfo } from "@/server/shop/settings";
import { saveShopInfoAction, type FormState } from "./actions";

function Field({ label, name, defaultValue, type = "text", multiline }: { label: string; name: keyof ShopInfo; defaultValue: string | number; type?: string; multiline?: boolean }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <textarea id={id} name={name} defaultValue={defaultValue} rows={3} className="rounded-lg border border-input bg-background px-3 py-2 text-base" />
      ) : (
        <Input id={id} name={name} type={type} defaultValue={defaultValue} className="h-11 text-base" />
      )}
    </div>
  );
}

export function SettingsForm({ info }: { info: ShopInfo }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveShopInfoAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Tên cửa hàng" name="name" defaultValue={info.name} />
      <Field label="Số điện thoại" name="phone" type="tel" defaultValue={info.phone} />
      <Field label="Số Zalo" name="zalo" type="tel" defaultValue={info.zalo} />
      <Field label="Địa chỉ" name="address" defaultValue={info.address} />
      <Field label="Giờ mở cửa" name="hours" defaultValue={info.hours} />
      <Field label="Số ngày bảo hành máy cũ" name="warrantyUsedDays" type="number" defaultValue={info.warrantyUsedDays} />
      <Field label="Chính sách bảo hành" name="warrantyText" defaultValue={info.warrantyText} multiline />
      <Field label="Chính sách đổi trả" name="returnText" defaultValue={info.returnText} multiline />
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.ok && <p className="text-sm text-emerald-700">Đã lưu — website cập nhật ngay.</p>}
      <Button type="submit" disabled={pending} className="h-11">
        Lưu cài đặt
      </Button>
    </form>
  );
}
