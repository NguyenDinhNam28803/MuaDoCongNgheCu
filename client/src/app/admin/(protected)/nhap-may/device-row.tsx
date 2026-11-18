"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { Choice } from "@/components/choice";
import { ImeiScanner } from "@/components/imei-scanner";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatVnd } from "@/lib/money";
import type { VariantSearchResult } from "@/server/catalog/products";
import { checkIdentifierAction, searchVariantsAction, type IdentifierResult } from "./actions";

function identifierMessage(r: IdentifierResult | null): { text: string; blocking: boolean } | null {
  if (!r) return null;
  if ("error" in r) return { text: r.error, blocking: true };
  switch (r.check.status) {
    case "new":
      return { text: "Máy mới, chưa có trong hệ thống", blocking: false };
    case "buyback":
      return {
        text:
          r.check.recentAcquisitions >= 2
            ? `Máy từng bán ra, sẽ nhập lại với lịch sử cũ — đã nhập ${r.check.recentAcquisitions} lần trong 90 ngày, cần xem xét nguồn gốc`
            : "Máy từng bán ra, sẽ nhập lại với lịch sử cũ",
        blocking: false,
      };
    case "in-stock":
      return { text: "IMEI đang có trong kho", blocking: true };
    case "blocked":
      return { text: "Máy này từng bị loại (khóa tài khoản/không đạt), không nhận", blocking: true };
  }
}

export function DeviceRow({
  row,
  index,
  defaultCondition,
  canRemove,
  onRemove,
  onBlockingChange,
}: {
  row: string;
  index: number;
  defaultCondition: "NEW" | "USED";
  canRemove: boolean;
  onRemove: () => void;
  onBlockingChange: (row: string, blocking: boolean) => void;
}) {
  const idInput = useId();
  const searchInput = useId();
  const [identifier, setIdentifier] = useState("");
  const [checkResult, setCheckResult] = useState<IdentifierResult | null>(null);
  const [checking, startCheck] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VariantSearchResult[]>([]);
  const [variant, setVariant] = useState<VariantSearchResult | null>(null);
  // Mặc định theo nguồn nhập; người dùng chọn tay thì giữ lựa chọn đó.
  const [conditionOverride, setCondition] = useState<"NEW" | "USED" | null>(null);
  const condition = conditionOverride ?? defaultCondition;

  const message = identifierMessage(checkResult);
  useEffect(() => onBlockingChange(row, !!message?.blocking), [row, message?.blocking, onBlockingChange]);

  const runCheck = useCallback(
    (value: string) => {
      if (!value.trim()) {
        setCheckResult(null);
        return;
      }
      startCheck(async () => setCheckResult(await checkIdentifierAction(value)));
    },
    [],
  );

  const onScanned = useCallback(
    (imei: string) => {
      setIdentifier(imei);
      runCheck(imei);
    },
    [runCheck],
  );

  const searching = query.trim().length >= 2;
  useEffect(() => {
    if (!searching) return;
    const t = setTimeout(async () => setResults(await searchVariantsAction(query)), 250);
    return () => clearTimeout(t);
  }, [query, searching]);
  const shownResults = searching ? results : [];

  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border bg-card px-4 pt-2 pb-4">
      <legend className="px-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">Máy thứ {index + 1}</legend>
      <input type="hidden" name="row" value={row} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={idInput}>IMEI hoặc serial</Label>
        <Input
          id={idInput}
          name={`identifier-${row}`}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          onBlur={() => runCheck(identifier)}
          inputMode="text"
          autoComplete="off"
          className={`h-11 font-mono text-base ${message ? (message.blocking ? "border-destructive" : "border-brand") : ""}`}
        />
        <ImeiScanner onDetected={onScanned} />
        {checking && <p className="text-[13px] text-muted-foreground">Đang kiểm tra…</p>}
        {!checking && message && (
          <p className={`flex items-start gap-1.5 text-[13px] font-semibold ${message.blocking ? "text-destructive" : "text-brand-ink"}`}>
            {message.blocking ? <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />}
            {message.text}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={searchInput}>Tìm model</Label>
        <input type="hidden" name={`variant-${row}`} value={variant?.variantId ?? ""} />
        {variant ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border-[1.5px] border-brand bg-brand-soft py-1.5 pr-1.5 pl-3">
            <span className="text-sm">
              <span className="font-bold">{variant.productName}</span> · {variant.label}
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setVariant(null)}>
              Đổi
            </Button>
          </div>
        ) : (
          <>
            <Input
              id={searchInput}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="vd: iphone 13, macbook air"
              autoComplete="off"
              className="h-11 text-base"
            />
            {shownResults.length > 0 && (
              <div className="flex flex-col divide-y overflow-hidden rounded-xl border">
                {shownResults.map((r) => (
                  <button
                    key={r.variantId}
                    type="button"
                    className="min-h-11 px-3 py-2 text-left text-sm hover:bg-brand-soft"
                    onClick={() => {
                      setVariant(r);
                      setQuery("");
                      setResults([]);
                    }}
                  >
                    {r.productName} · {r.label}
                  </button>
                ))}
              </div>
            )}
            {searching && shownResults.length === 0 && (
              <p className="text-xs text-muted-foreground">Không thấy model? Nhờ chủ cửa hàng thêm trong Catalog.</p>
            )}
          </>
        )}
        {variant && <p className="font-mono text-xs text-muted-foreground">Giá tham chiếu: {formatVnd(variant.referencePrice)}</p>}
      </div>

      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Tình trạng">
        {(["USED", "NEW"] as const).map((c) => (
          <Choice key={c} name={`condition-${row}`} value={c} checked={condition === c} onChange={() => setCondition(c)}>
            {c === "USED" ? "Đã dùng" : "Mới"}
          </Choice>
        ))}
      </div>

      <MoneyInput name={`price-${row}`} label="Giá nhập" required />

      {canRemove && (
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="self-start">
          Bỏ máy này
        </Button>
      )}
    </fieldset>
  );
}
