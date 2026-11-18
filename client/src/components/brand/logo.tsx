// Logo TECNOVA: biểu tượng (khung ngắm + dấu kiểm) và chữ "TEC" + "NOVA" màu nhấn.
type Tone = "light" | "dark";

export function LogoMark({ size = 36, tone = "light", className }: { size?: number; tone?: Tone; className?: string }) {
  const bg = tone === "light" ? "var(--ink)" : "#ffffff";
  const frame = tone === "light" ? "#ffffff" : "var(--ink)";
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden="true" className={className}>
      <rect width="88" height="88" rx="22" fill={bg} />
      <path
        d="M22 34 V24 H32 M56 24 H66 V34 M66 54 V64 H56 M32 64 H22 V54"
        fill="none"
        stroke={frame}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M33 45 L41 53 L56 37" fill="none" stroke="var(--brand)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Chữ logo. Tên mặc định "TECNOVA" tô "NOVA" màu nhấn; tên khác (chủ shop đổi trong Cài đặt) hiển thị nguyên văn.
 */
export function Wordmark({ name = "TECNOVA", tone = "light", className = "" }: { name?: string; tone?: Tone; className?: string }) {
  const accent = tone === "light" ? "text-brand" : "text-brand-bright";
  const upper = name.toUpperCase();
  const split = upper === "TECNOVA";
  return (
    <span className={`font-extrabold tracking-[-0.01em] ${className}`}>
      {split ? (
        <>
          TEC<span className={accent}>NOVA</span>
        </>
      ) : (
        name
      )}
    </span>
  );
}

export function Logo({
  name,
  size = 32,
  tone = "light",
  textClassName = "text-xl",
}: {
  name?: string;
  size?: number;
  tone?: Tone;
  textClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} tone={tone} />
      <Wordmark name={name} tone={tone} className={textClassName} />
    </span>
  );
}

/** Con dấu "ĐÃ KIỂM ĐỊNH" dùng trên hộ chiếu thiết bị. */
export function VerifiedStamp({ label = "ĐÃ KIỂM ĐỊNH" }: { label?: string }) {
  return (
    <span className="inline-flex -rotate-3 items-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-brand px-2.5 py-1 font-mono text-xs font-semibold tracking-wide text-brand">
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12.5 L10 17 L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </span>
  );
}
