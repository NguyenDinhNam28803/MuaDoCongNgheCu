"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatVnd, parseVndInput } from "@/lib/money";

/**
 * Ô nhập tiền: gửi chuỗi gốc lên server (server parse lại bằng parseVndInput),
 * bên dưới xem trước số tiền đã hiểu. Gõ được "15,5tr", "500k", "15.500.000".
 */
export function MoneyInput({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: bigint | null;
  required?: boolean;
}) {
  const id = useId();
  const [value, setValue] = useState(defaultValue === null || defaultValue === undefined ? "" : defaultValue.toString());
  const parsed = value.trim() ? parseVndInput(value) : null;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode="text"
        autoComplete="off"
        placeholder="vd: 15,5tr hoặc 500k"
        required={required}
        className="h-11 text-base"
      />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {!value.trim() ? " " : parsed === null ? "Giá không hợp lệ" : formatVnd(parsed)}
      </p>
    </div>
  );
}
