"use client";

import { useActionState, useId, useState } from "react";
import { Choice } from "@/components/choice";
import { MoneyInput } from "@/components/money-input";
import { PhotoCapture } from "@/components/photo-capture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Condition, Grade, ProductCategory } from "@/generated/prisma/enums";
import { GRADE_CRITERIA, checklistFor, partsFor, type ChecklistResultValue } from "@/server/inspection/templates";
import { submitInspectionAction, type FormState } from "../actions";

const RESULT_LABEL: Record<ChecklistResultValue, string> = { ok: "Đạt", issue: "Lỗi", na: "Không áp dụng" };
const REGIONS = ["VN/A", "LL/A", "J/A", "ZA/A", "KH/A", "CH/A"];
const DECISIONS = [
  ["LIST", "Lên kệ bán", "Đủ điều kiện, nhập giá và hiện trên website"],
  ["REFURBISH", "Cần tân trang", "Thay linh kiện / làm mới rồi mới lên kệ"],
  ["REJECT", "Loại bỏ", "Không bán — bắt buộc ghi lý do"],
] as const;

function Card({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-extrabold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function YesNo({ name, question, value, onChange, yesTone = "brand" }: { name: string; question: string; value: string; onChange: (v: string) => void; yesTone?: "brand" | "warn" }) {
  return (
    <div role="radiogroup" aria-label={question} className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{question}</p>
      <div className="grid grid-cols-2 gap-2">
        <Choice name={name} value="yes" checked={value === "yes"} onChange={() => onChange("yes")} tone={yesTone}>
          Có
        </Choice>
        <Choice name={name} value="no" checked={value === "no"} onChange={() => onChange("no")} tone={yesTone === "warn" ? "brand" : "warn"}>
          Không
        </Choice>
      </div>
    </div>
  );
}

export function InspectionForm({
  deviceId,
  category,
  condition,
}: {
  deviceId: string;
  category: ProductCategory;
  condition: Condition;
}) {
  const items = checklistFor(category);
  const parts = partsFor(category);
  const isUsed = condition === "USED";
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    submitInspectionAction.bind(null, deviceId, category),
    {},
  );
  const [results, setResults] = useState<Record<string, ChecklistResultValue | undefined>>({});
  const [grade, setGrade] = useState<Grade | null>(null);
  const [photoSlots, setPhotoSlots] = useState(isUsed ? 4 : 1);
  const [locked, setLocked] = useState("");
  const [wiped, setWiped] = useState("");
  const [decision, setDecision] = useState<"LIST" | "REFURBISH" | "REJECT">("LIST");
  const effectiveDecision = locked === "yes" ? "REJECT" : decision;
  const answered = items.filter((i) => results[i.key]).length;
  const issues = items.filter((i) => results[i.key] === "issue").length;
  const batteryId = useId();
  const regionId = useId();
  const notesId = useId();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex items-center gap-3" aria-live="polite">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(answered / items.length) * 100}%` }} />
        </div>
        <span className="font-mono text-sm font-semibold">
          {answered}/{items.length}
        </span>
      </div>

      <Card
        title="Checklist"
        aside={
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl border-ink"
            onClick={() => setResults(Object.fromEntries(items.map((i) => [i.key, "ok"])))}
          >
            Tất cả đạt
          </Button>
        }
      >
        {issues > 0 && <p className="text-sm font-semibold text-warn">{issues} mục lỗi — nhớ mô tả lỗi để khách đọc trong hộ chiếu.</p>}
        {items.map((item) => (
          <fieldset key={item.key} className="flex flex-col gap-2 rounded-xl border p-3">
            <legend className="px-1 text-sm">{item.label}</legend>
            <div className="grid grid-cols-3 gap-1.5">
              {(["ok", "issue", "na"] as const).map((r) => (
                <Choice
                  key={r}
                  name={`check-${item.key}`}
                  value={r}
                  checked={results[item.key] === r}
                  onChange={() => setResults((s) => ({ ...s, [item.key]: r }))}
                  tone={r === "issue" ? "warn" : r === "ok" ? "brand" : "ink"}
                  className="h-10 min-h-10 px-1 text-[13px]"
                >
                  {RESULT_LABEL[r]}
                </Choice>
              ))}
            </div>
            {results[item.key] === "issue" && (
              <Input
                name={`note-${item.key}`}
                aria-label={`Ghi chú: ${item.label}`}
                placeholder="Mô tả lỗi, vd: loa ngoài hơi rè"
                className="h-10 border-warn bg-warn-soft"
              />
            )}
          </fieldset>
        ))}
      </Card>

      <Card title="Thông số">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={batteryId}>% pin</Label>
            <Input id={batteryId} name="batteryPct" type="number" inputMode="numeric" min={0} max={100} className="h-11 font-mono text-base" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={regionId}>Mã vùng</Label>
            <Input id={regionId} name="regionCode" list={`${regionId}-list`} className="h-11 font-mono text-base" />
            <datalist id={`${regionId}-list`}>
              {REGIONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
        </div>

        {isUsed && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">Hạng máy</legend>
            <div className="grid grid-cols-3 gap-2">
              {(["A", "B", "C"] as const).map((g) => (
                <Choice
                  key={g}
                  name="grade"
                  value={g}
                  checked={grade === g}
                  onChange={() => setGrade(g)}
                  ariaLabel={`Hạng ${g}`}
                  className="h-13 text-lg font-extrabold"
                >
                  {g}
                </Choice>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {grade ? `Hạng ${grade}: ${GRADE_CRITERIA[grade]}` : "Chọn hạng theo tiêu chí — tiêu chí hiện ở đây sau khi chọn."}
            </p>
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">Linh kiện đã thay</legend>
          <div className="flex flex-wrap gap-1.5">
            {parts.map((p) => (
              <Choice key={p} type="checkbox" name="replacedParts" value={p} className="min-h-9 rounded-full px-3.5 text-[13px]">
                {p}
              </Choice>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="isRefurbished" className="size-5 accent-brand" />
          Máy đã được tân trang (thay linh kiện, làm mới vỏ)
        </label>
      </Card>

      <Card title={`Ảnh thật (${isUsed ? "4–6" : "1–6"} ảnh)`}>
        {Array.from({ length: photoSlots }, (_, i) => (
          <PhotoCapture key={i} kind="device" name="photoKeys" label={`Ảnh ${i + 1}`} />
        ))}
        {photoSlots < 6 && (
          <Button type="button" variant="outline" className="h-11 rounded-xl border-dashed" onClick={() => setPhotoSlots((n) => n + 1)}>
            + Thêm ảnh
          </Button>
        )}
      </Card>

      <Card title="Bắt buộc trước khi lên kệ">
        <YesNo name="accountLocked" question="Máy còn khóa tài khoản (iCloud/Google/MDM)?" value={locked} onChange={setLocked} yesTone="warn" />
        <YesNo name="dataWiped" question="Đã xóa dữ liệu và đăng xuất mọi tài khoản?" value={wiped} onChange={setWiped} />
        {locked === "yes" && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            Máy còn khóa tài khoản không được bán — chỉ có thể loại bỏ.
          </p>
        )}
      </Card>

      <Card title="Kết quả">
        <input type="hidden" name="decision" value={effectiveDecision} />
        <div className="flex flex-col gap-2">
          {DECISIONS.map(([value, label, hint]) => (
            <Choice
              key={value}
              name="decisionChoice"
              value={value}
              checked={effectiveDecision === value}
              disabled={locked === "yes" && value !== "REJECT"}
              onChange={() => setDecision(value)}
              tone={value === "REJECT" ? "ink" : "brand"}
              ariaLabel={label}
              className="min-h-14 flex-col items-start justify-center px-4 text-left"
            >
              <span className="text-[15px] font-bold">{label}</span>
              <span className="text-xs opacity-80">{hint}</span>
            </Choice>
          ))}
        </div>
        {effectiveDecision === "LIST" && <MoneyInput name="listPrice" label="Giá bán" required />}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={notesId}>Ghi chú kiểm định</Label>
          <textarea
            id={notesId}
            name="notes"
            rows={3}
            placeholder={effectiveDecision === "REJECT" ? "Lý do loại bỏ (bắt buộc)" : "Không bắt buộc"}
            className="rounded-xl border-[1.5px] border-input bg-background px-3 py-2 text-base"
          />
        </div>
      </Card>

      {state.error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="sticky bottom-[4.5rem] z-10 -mx-4 border-t bg-surface/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-2xl md:border">
        <Button type="submit" disabled={pending} className="h-13 w-full rounded-xl text-base">
          {pending ? "Đang lưu…" : "Lưu kiểm định"}
        </Button>
      </div>
    </form>
  );
}
