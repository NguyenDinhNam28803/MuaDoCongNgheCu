// Banner 3D TECNOVA: điện thoại xoay nhẹ, tia quét kiểm định, các chỉ số bay quanh.
// Thuần CSS 3D (globals.css: .hero3d-*), không JS — nhẹ trên điện thoại; tự đứng yên khi bật giảm chuyển động.
import { Check } from "lucide-react";

function Chip({ className, style, children, delay }: { className?: string; style?: React.CSSProperties; children: React.ReactNode; delay: string }) {
  return (
    <div
      className={`hero3d-float rounded-2xl border border-white/10 bg-white px-3.5 py-2.5 text-ink shadow-[0_18px_40px_-12px_rgb(0_0_0/0.5)] ${className ?? ""}`}
      style={{ animationDelay: delay, ...style }}
    >
      {children}
    </div>
  );
}

export function Hero3D() {
  return (
    <div className="hero3d flex h-105 items-center justify-center sm:h-125" aria-hidden="true">
      <div className="hero3d-stage scale-[0.8] sm:scale-100">
        <div className="hero3d-phone">
          <div className="hero3d-screen">
            {/* Khung ngắm như biểu tượng thương hiệu */}
            <svg viewBox="0 0 200 420" className="absolute inset-0 size-full">
              <path
                d="M28 96 V66 H58 M142 66 H172 V96 M172 252 V282 H142 M58 282 H28 V252"
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.85"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                className="hero3d-check"
                d="M62 172 L86 196 L140 136"
                fill="none"
                stroke="var(--brand-bright)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="hero3d-scanline" />
            <div className="absolute inset-x-0 bottom-9 text-center font-mono text-[11px] font-semibold tracking-[0.18em] text-white/80">
              ĐANG KIỂM ĐỊNH
              <div className="mt-1 text-lg tracking-normal text-brand-bright">14/14</div>
            </div>
            <div className="absolute top-3 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
          </div>

          <Chip delay="0s" className="-left-24 top-16 sm:-left-32" style={{ transform: "translateZ(70px)" }}>
            <p className="text-[11px] font-semibold text-muted-foreground">Pin</p>
            <p className="font-mono text-xl font-semibold">89%</p>
          </Chip>
          <Chip delay="-1.4s" className="-right-20 top-28 sm:-right-28" style={{ transform: "translateZ(90px)" }}>
            <p className="text-[11px] font-semibold text-muted-foreground">Hạng</p>
            <p className="text-xl font-extrabold text-brand">A</p>
          </Chip>
          <Chip delay="-2.6s" className="-left-20 bottom-24 flex items-center gap-2 sm:-left-28" style={{ transform: "translateZ(60px)" }}>
            <span className="flex size-6 items-center justify-center rounded-full bg-brand-soft">
              <Check className="size-4 text-brand" />
            </span>
            <span className="text-sm font-semibold">Face ID · Đạt</span>
          </Chip>
          <div
            className="hero3d-float absolute -right-14 -bottom-4 sm:-right-24"
            style={{ transform: "translateZ(110px) rotate(-6deg)", animationDelay: "-3.6s" }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-xl border-2 border-brand-bright bg-ink/90 px-3 py-2 font-mono text-xs font-semibold tracking-wide text-brand-bright">
              <Check className="size-3.5" />
              ĐÃ KIỂM ĐỊNH
            </span>
          </div>
        </div>
        <div className="hero3d-glow" />
      </div>
    </div>
  );
}
