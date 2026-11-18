"use client";

// Ước tính giá thu cũ: dùng ĐÚNG hệ số của công thức định giá (src/server/pricing/trade-in.ts).
import { useState } from "react";
import type { Grade } from "@/generated/prisma/enums";
import { DEFAULT_TRADE_IN_CONFIG } from "@/server/pricing/trade-in";

const GRADES: Grade[] = ["A", "B", "C"];
const BATTERY = [
  { label: "≥ 90%", pct: 95 },
  { label: "85–89%", pct: 87 },
  { label: "80–84%", pct: 82 },
  { label: "< 80%", pct: 70 },
];

function batteryPermille(pct: number) {
  const tiers = DEFAULT_TRADE_IN_CONFIG.batteryTiers;
  return (tiers.find((t) => pct >= t.minPct) ?? tiers[tiers.length - 1]).permille;
}

const option = (on: boolean) =>
  `h-12 rounded-xl border-[1.5px] font-bold transition ${on ? "border-brand-bright bg-brand-bright text-ink" : "border-white/25 hover:border-white"}`;

export function TradeInEstimator({ zalo }: { zalo: string }) {
  const [grade, setGrade] = useState<Grade>("A");
  const [battery, setBattery] = useState(0);
  const g = DEFAULT_TRADE_IN_CONFIG.gradePermille[grade] / 10;
  const b = batteryPermille(BATTERY[battery].pct) / 10;
  const total = Math.round((g * b) / 100);

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Tình trạng máy" className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-white/70">Tình trạng máy</p>
        <div className="grid grid-cols-3 gap-2">
          {GRADES.map((k) => (
            <button key={k} type="button" aria-pressed={grade === k} onClick={() => setGrade(k)} className={option(grade === k)}>
              Hạng {k}
            </button>
          ))}
        </div>
      </div>
      <div role="group" aria-label="Pin còn" className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-white/70">Pin còn</p>
        <div className="grid grid-cols-4 gap-2">
          {BATTERY.map((x, i) => (
            <button key={x.label} type="button" aria-pressed={battery === i} onClick={() => setBattery(i)} className={`${option(battery === i)} font-mono text-xs sm:text-sm`}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-white/15 bg-white/5 p-4 font-mono text-[15px] leading-loose" aria-live="polite">
        <p className="flex justify-between">
          <span className="text-white/70">Giá tham chiếu model</span>
          <span>100%</span>
        </p>
        <p className="flex justify-between">
          <span className="text-white/70">× Hệ số hạng {grade}</span>
          <span>{g}%</span>
        </p>
        <p className="flex justify-between">
          <span className="text-white/70">× Hệ số pin</span>
          <span>{b}%</span>
        </p>
        <p className="mt-1 flex flex-wrap justify-between gap-x-3 border-t border-dashed border-white/25 pt-1 font-semibold text-brand-bright">
          <span>= Giá thu dự kiến</span>
          <span>{total}% giá tham chiếu</span>
        </p>
      </div>
      <p className="text-xs text-white/60">Trừ thêm nếu thiếu hộp, đã thay linh kiện… Giá chốt sau khi xem máy thật.</p>
      <a
        href={`https://zalo.me/${zalo}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-12 items-center self-start rounded-xl bg-brand-bright px-6 font-bold text-ink"
      >
        Gửi thông tin máy qua Zalo
      </a>
    </div>
  );
}
