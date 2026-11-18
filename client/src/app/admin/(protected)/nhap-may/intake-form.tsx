"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useActionState, useCallback, useId, useRef, useState } from "react";
import { Choice, StepTitle } from "@/components/choice";
import { PhotoCapture } from "@/components/photo-capture";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { intakeAction, type IntakeState } from "./actions";
import { DeviceRow } from "./device-row";

type Source = "TRADE_IN" | "WHOLESALE" | "NEW_STOCK";

const SOURCES: { value: Source; label: string }[] = [
  { value: "TRADE_IN", label: "Thu từ khách" },
  { value: "WHOLESALE", label: "Nhập buôn" },
  { value: "NEW_STOCK", label: "Nhập máy mới (NPP)" },
];

function Field({ label, name, type = "text", inputMode }: { label: string; name: string; type?: string; inputMode?: "tel" | "text" }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type={type} inputMode={inputMode} autoComplete="off" className="h-11 text-base" />
    </div>
  );
}

function IntakeFormInner({ onReset }: { onReset: () => void }) {
  const [state, formAction, pending] = useActionState<IntakeState, FormData>(intakeAction, {});
  const [source, setSource] = useState<Source>("TRADE_IN");
  // Id hàng phải giống nhau giữa server và client → hàng đầu cố định, hàng thêm sau đếm trong component.
  const [rows, setRows] = useState<string[]>(["r0"]);
  const nextRow = useRef(1);
  const [blocking, setBlocking] = useState<Record<string, boolean>>({});

  const onBlockingChange = useCallback((row: string, value: boolean) => {
    setBlocking((b) => (b[row] === value ? b : { ...b, [row]: value }));
  }, []);
  const hasBlocking = rows.some((r) => blocking[r]);
  const sourceLabel = SOURCES.find((s) => s.value === source)!.label;

  if (state.done) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-8 text-brand" aria-hidden />
          <p className="text-lg font-extrabold text-brand-ink">Đã nhập {state.done.count} máy vào kho</p>
        </div>
        {state.warnings?.map((w) => (
          <p key={w} role="alert" className="rounded-xl bg-warn-soft px-3 py-2.5 text-sm text-warn-ink">
            {w}
          </p>
        ))}
        <p className="text-sm text-muted-foreground">Bước tiếp theo: kiểm định máy để đưa lên kệ.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" onClick={onReset} className="h-12 rounded-xl">
            Nhập máy khác
          </Button>
          <Link href="/admin/kho?tab=processing" className={buttonVariants({ variant: "outline", className: "h-12 rounded-xl border-ink" })}>
            Xem trong kho
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <StepTitle n={1}>Nguồn máy</StepTitle>
        <input type="hidden" name="type" value={source} />
        <div role="radiogroup" aria-label="Nguồn máy" className="grid grid-cols-3 gap-1.5">
          {SOURCES.map((s) => (
            <Choice
              key={s.value}
              name="source"
              value={s.value}
              checked={source === s.value}
              onChange={() => setSource(s.value)}
              tone="ink"
              className="min-h-13 px-1.5 text-[13px] leading-tight font-semibold"
            >
              {s.label}
            </Choice>
          ))}
        </div>
      </section>

      {source === "TRADE_IN" ? (
        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <StepTitle n={2}>Người bán</StepTitle>
          <Field label="Họ tên người bán" name="sellerName" />
          <Field label="Số điện thoại người bán" name="sellerPhone" type="tel" inputMode="tel" />
          <PhotoCapture kind="id-doc" name="idDocKey" label="Ảnh CCCD/giấy tờ" required />
          <p className="-mt-1 text-xs text-muted-foreground">Lưu riêng, chỉ chủ cửa hàng xem được.</p>
          <label className="flex items-start gap-2.5 text-sm leading-snug">
            <input type="checkbox" name="originPledged" className="mt-0.5 size-5 shrink-0 accent-brand" />
            Người bán cam kết máy thuộc sở hữu hợp pháp, không phải tài sản trộm cắp hay tranh chấp
          </label>
          <label className="flex items-start gap-2.5 text-sm leading-snug">
            <input type="checkbox" name="consent" className="mt-0.5 size-5 shrink-0 accent-brand" />
            Người bán đồng ý cho cửa hàng lưu thông tin để đối chiếu nguồn gốc
          </label>
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <StepTitle n={2}>Nguồn hàng</StepTitle>
          <Field label="Tên nguồn hàng" name="sourceName" />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <StepTitle n={3}>Máy</StepTitle>
        {rows.map((row, i) => (
          <DeviceRow
            key={row}
            row={row}
            index={i}
            defaultCondition={source === "NEW_STOCK" ? "NEW" : "USED"}
            canRemove={rows.length > 1}
            onRemove={() => setRows((rs) => rs.filter((r) => r !== row))}
            onBlockingChange={onBlockingChange}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-xl border-dashed"
          onClick={() => {
            const row = `r${nextRow.current++}`;
            setRows((rs) => [...rs, row]);
          }}
        >
          + Thêm máy
        </Button>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <Field label="Ghi chú (không bắt buộc)" name="note" />
      </section>

      {state.error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="sticky bottom-[4.5rem] z-10 -mx-4 flex flex-col gap-2 border-t bg-surface/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-2xl md:border">
        <p className="flex justify-between text-sm text-muted-foreground">
          <span>
            {rows.length} máy · {sourceLabel}
          </span>
          {hasBlocking && <span className="font-semibold text-warn">Có máy không nhận được</span>}
        </p>
        <Button type="submit" disabled={pending || hasBlocking} className="h-13 rounded-xl text-base">
          {pending ? "Đang nhập…" : "Nhập kho"}
        </Button>
      </div>
    </form>
  );
}

/** Đổi key sau khi nhập xong để form trống lại cho máy kế tiếp. */
export function IntakeForm() {
  const [key, setKey] = useState(0);
  return <IntakeFormInner key={key} onReset={() => setKey((k) => k + 1)} />;
}
