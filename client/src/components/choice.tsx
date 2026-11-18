// Nút chọn lớn cho điện thoại (TECNOVA). Bên dưới là <input> thật phủ trong suốt lên nút:
// form hoạt động không cần JS, trình đọc màn hình đọc đúng, test bấm được.
import type { ReactNode } from "react";

type Tone = "brand" | "warn" | "ink";

const CHECKED: Record<Tone, string> = {
  brand: "has-checked:border-brand has-checked:bg-brand-soft has-checked:text-brand-ink has-checked:font-bold has-checked:border-2",
  warn: "has-checked:border-warn has-checked:bg-warn-soft has-checked:text-warn-ink has-checked:font-bold has-checked:border-2",
  ink: "has-checked:border-ink has-checked:bg-ink has-checked:text-white has-checked:font-bold",
};

export function Choice({
  type = "radio",
  name,
  value,
  checked,
  defaultChecked,
  onChange,
  disabled,
  tone = "brand",
  ariaLabel,
  className = "",
  children,
}: {
  type?: "radio" | "checkbox";
  name: string;
  value: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: () => void;
  disabled?: boolean;
  tone?: Tone;
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={`relative flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-[1.5px] bg-card px-3 text-center text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring has-disabled:cursor-not-allowed has-disabled:opacity-45 ${CHECKED[tone]} ${className}`}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
      />
      {children}
    </label>
  );
}

export function StepTitle({ n, children }: { n: number | string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-white">{n}</span>
      <h2 className="text-base font-extrabold">{children}</h2>
    </div>
  );
}
