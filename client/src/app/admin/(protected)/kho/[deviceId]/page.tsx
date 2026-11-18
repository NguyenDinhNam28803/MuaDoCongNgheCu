import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { ACQUISITION_LABEL, CONDITION_LABEL, STATUS_LABEL } from "@/lib/device-labels";
import { formatVnd } from "@/lib/money";
import { prisma } from "@/server/db";
import { AlertTriangle, ExternalLink } from "lucide-react";
import type { DeviceStatus } from "@/generated/prisma/enums";
import { can } from "@/server/auth/permissions";
import { deviceSlug } from "@/server/shop/queries";
import { getLatestReport } from "@/server/inspection/service";
import { getDeviceDetail } from "@/server/inventory/queries";
import { publicUrl } from "@/server/storage/s3";
import { DeviceActions } from "./device-actions";
import { IdDocButton } from "./id-doc-button";

export const metadata: Metadata = { title: "Chi tiết máy" };

const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

const STATUS_TONE: Record<DeviceStatus, string> = {
  INTAKE: "bg-muted text-foreground",
  INSPECTING: "bg-warn-soft text-warn-ink",
  REFURBISHING: "bg-[#e6eef5] text-[#1f4e6b]",
  LISTED: "bg-brand-soft text-brand-ink",
  RESERVED: "bg-ink text-white",
  SOLD: "bg-muted text-muted-foreground",
  RETURNED: "bg-warn-soft text-warn-ink",
  REJECTED: "bg-destructive/10 text-destructive",
};

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-extrabold">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

export default async function DevicePage({ params }: PageProps<"/admin/kho/[deviceId]">) {
  const user = await requireUser();
  const { deviceId } = await params;
  const [d, report] = await Promise.all([getDeviceDetail(prisma, user, deviceId), getLatestReport(prisma, deviceId)]);
  if (!d) notFound();

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Link href="/admin/kho" className="text-sm font-semibold text-muted-foreground">
        ← Kho
      </Link>
      <div className="flex flex-col gap-2">
        <span className={`self-start rounded-full px-3 py-1 text-[13px] font-bold ${STATUS_TONE[d.status]}`}>{STATUS_LABEL[d.status]}</span>
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
          {d.productName} <span className="font-medium text-muted-foreground">{d.variantLabel}</span>
        </h1>
        <p className="font-mono text-[13px] text-muted-foreground">
          {d.imei ? `IMEI ${d.imei}` : d.serial ? `Serial ${d.serial}` : "—"}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <Fact label="Giá bán" value={<span className="text-brand">{formatVnd(d.listPrice)}</span>} />
        {d.costPrice !== undefined && <Fact label="Giá vốn" value={formatVnd(d.costPrice)} />}
        <Fact
          label="Hạng · Pin"
          value={
            <>
              {d.grade ?? "—"} · <span className="font-mono font-semibold">{d.batteryPct !== null ? `${d.batteryPct}%` : "—"}</span>
            </>
          }
        />
        <Fact label="Tồn kho" value={<span className={`font-mono ${d.ageDays > 30 ? "text-warn" : ""}`}>{d.ageDays} ngày</span>} />
      </dl>

      <DeviceActions
        deviceId={deviceId}
        status={d.status}
        canInspect={can(user.role, "device.inspect")}
        canEditPrice={can(user.role, "device.editPrice")}
      />
      {(d.status === "LISTED" || d.status === "RESERVED") && (
        <a
          href={`/may/${deviceSlug(d.productName, d.variantLabel)}-${d.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold"
        >
          Xem trên website
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      )}

      <dl className="divide-y rounded-2xl border bg-card px-4">
        <Row label="Tình trạng" value={`${CONDITION_LABEL[d.condition]}${d.isRefurbished ? " · đã tân trang" : ""}`} />
        <Row label="Mã vùng" value={d.regionCode ?? "—"} />
      </dl>

      {d.acquisition && (
        <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold">Nguồn nhập</h2>
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground">CHỈ CHỦ XEM</span>
          </div>
          <dl className="divide-y">
            <Row label="Hình thức" value={ACQUISITION_LABEL[d.acquisition.type]} />
            <Row label="Ngày nhập" value={dateTime.format(d.acquisition.createdAt)} />
            {d.acquisition.sellerName && <Row label="Người bán" value={d.acquisition.sellerName} />}
            {d.acquisition.sellerPhone && <Row label="SĐT người bán" value={d.acquisition.sellerPhone} />}
            {d.acquisition.sourceName && <Row label="Nguồn hàng" value={d.acquisition.sourceName} />}
            <Row label="Tổng phiếu" value={formatVnd(d.acquisition.totalPrice)} />
          </dl>
          {d.acquisition.hasIdDoc && <IdDocButton deviceId={deviceId} />}
        </section>
      )}

      {report && (
        <section aria-labelledby="report-heading" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 id="report-heading" className="text-base font-extrabold">
              Báo cáo kiểm định
            </h2>
            <p className="text-right font-mono text-xs text-muted-foreground">
              {dateTime.format(report.createdAt)}
              <br />
              {report.checklist.filter((c) => c.result === "ok").length}/{report.checklist.filter((c) => c.result !== "na").length} đạt
              {report.grade && ` · Hạng ${report.grade}`}
              {report.batteryPct !== null && ` · Pin ${report.batteryPct}%`}
            </p>
          </div>
          {report.photoKeys.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5">
              {report.photoKeys.map((key, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- ảnh từ kho S3/R2
                <img key={key} src={publicUrl(key)} alt={`Ảnh máy ${i + 1}`} loading="lazy" className="aspect-square w-full rounded-lg border object-cover" />
              ))}
            </div>
          )}
          {report.checklist
            .filter((c) => c.result === "issue")
            .map((c) => (
              <p key={c.key} className="flex gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[13px] text-warn-ink">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                <span>
                  <span className="font-semibold">{c.label}</span>
                  {c.note && `: ${c.note}`}
                </span>
              </p>
            ))}
          {report.replacedParts.length > 0 && <p className="text-sm">Linh kiện đã thay: {report.replacedParts.join(", ")}</p>}
          {report.notes && <p className="text-sm text-muted-foreground">{report.notes}</p>}
          <details>
            <summary className="flex min-h-10 cursor-pointer items-center text-sm font-semibold">Xem đủ {report.checklist.length} mục</summary>
            <ul className="flex flex-col text-sm">
              {report.checklist.map((c) => (
                <li key={c.key} className="flex justify-between gap-3 border-b border-muted py-1.5">
                  <span>{c.label}</span>
                  <span className={`font-semibold ${c.result === "issue" ? "text-warn" : c.result === "ok" ? "text-brand" : "text-muted-foreground"}`}>
                    {c.result === "ok" ? "Đạt" : c.result === "issue" ? "Lỗi" : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-extrabold">Lịch sử</h2>
        <ol className="flex flex-col">
          {[...d.events].reverse().map((e, i, all) => (
            <li key={i} className="flex gap-3">
              <span className="flex flex-col items-center" aria-hidden>
                <span className={`mt-1 size-3 rounded-full ${i === 0 ? "bg-ink" : e.toStatus === "LISTED" ? "bg-brand" : "bg-muted-foreground/60"}`} />
                {i < all.length - 1 && <span className="w-0.5 flex-1 bg-border" />}
              </span>
              <span className="pb-4 text-sm">
                <span className="block font-semibold">
                  {e.fromStatus && e.fromStatus !== e.toStatus ? `${STATUS_LABEL[e.fromStatus]} → ` : ""}
                  {STATUS_LABEL[e.toStatus]}
                  {e.reason && <span className="font-normal text-muted-foreground"> — {e.reason}</span>}
                </span>
                <span className="block font-mono text-xs text-muted-foreground">
                  {dateTime.format(e.createdAt)}
                  {e.actorName && ` · ${e.actorName}`}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
