"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DeviceStatus } from "@/generated/prisma/enums";
import {
  finishRefurbishAction,
  startInspectionAction,
  updatePriceAction,
  type FormState,
} from "./actions";

function ErrorText({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  ) : null;
}

function StartInspection({ deviceId }: { deviceId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(() => startInspectionAction(deviceId), {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" disabled={pending} className="h-11">
        Bắt đầu kiểm định
      </Button>
      <ErrorText error={state.error} />
    </form>
  );
}

function FinishRefurbish({ deviceId }: { deviceId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(finishRefurbishAction.bind(null, deviceId), {});
  const batteryId = useId();
  const noteId = useId();
  return (
    <section aria-labelledby={`${batteryId}-h`} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <h2 id={`${batteryId}-h`} className="text-base font-extrabold">
        Tân trang xong
      </h2>
      <form action={action} className="flex flex-col gap-3">
        <MoneyInput name="cost" label="Chi phí tân trang" />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={noteId}>Đã làm gì</Label>
          <Input id={noteId} name="note" placeholder="vd: thay pin, đánh bóng vỏ" className="h-11 text-base" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={batteryId}>% pin sau tân trang</Label>
          <Input id={batteryId} name="batteryPct" type="number" min={0} max={100} inputMode="numeric" className="h-11 text-base" />
        </div>
        <MoneyInput name="listPrice" label="Giá bán" required />
        <ErrorText error={state.error} />
        <Button type="submit" disabled={pending} className="h-11">
          Lên kệ
        </Button>
      </form>
    </section>
  );
}

function ChangePrice({ deviceId }: { deviceId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePriceAction.bind(null, deviceId), {});
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <h2 id={id} className="text-base font-extrabold">
        Đổi giá bán
      </h2>
      <form action={action} className="flex flex-col gap-3">
        <MoneyInput name="price" label="Giá bán mới" required />
        <ErrorText error={state.error} />
        <Button type="submit" variant="outline" disabled={pending}>
          Đổi giá
        </Button>
      </form>
    </section>
  );
}

export function DeviceActions({
  deviceId,
  status,
  canInspect,
  canEditPrice,
}: {
  deviceId: string;
  status: DeviceStatus;
  canInspect: boolean;
  canEditPrice: boolean;
}) {
  return (
    <>
      {canInspect && (status === "INTAKE" || status === "RETURNED") && <StartInspection deviceId={deviceId} />}
      {canInspect && status === "INSPECTING" && (
        <Link href={`/admin/kho/${deviceId}/kiem-dinh`} className={buttonVariants({ className: "h-11" })}>
          Tiếp tục kiểm định
        </Link>
      )}
      {canInspect && status === "REFURBISHING" && <FinishRefurbish deviceId={deviceId} />}
      {canEditPrice && (status === "LISTED" || status === "RESERVED") && <ChangePrice deviceId={deviceId} />}
    </>
  );
}
