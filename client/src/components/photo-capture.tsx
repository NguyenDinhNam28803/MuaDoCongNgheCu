"use client";

import imageCompression from "browser-image-compression";
import { Camera, RotateCcw } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { requestUploadAction } from "@/app/admin/(protected)/upload-actions";
import type { PhotoKind } from "@/server/storage/keys";

type Status = { state: "idle" } | { state: "uploading" } | { state: "done"; key: string } | { state: "error"; message: string };

/**
 * Chụp/chọn ảnh → nén WebP (≤1600px, q=0.8) → PUT thẳng lên kho ảnh → đặt key vào input ẩn `name`.
 * Tải lỗi thì input ẩn để trống, form không gửi được (required).
 */
export function PhotoCapture({
  kind,
  name,
  label,
  required,
}: {
  kind: PhotoKind;
  name: string;
  label: string;
  required?: boolean;
}) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [preview, setPreview] = useState<string | null>(null);

  async function upload(file: File) {
    setLastFile(file);
    setStatus({ state: "uploading" });
    try {
      const compressed = await imageCompression(file, {
        maxWidthOrHeight: 1600,
        fileType: "image/webp",
        initialQuality: 0.8,
        maxSizeMB: 0.5,
        useWebWorker: true,
      });
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(compressed);
      });
      const grant = await requestUploadAction(kind, "image/webp", compressed.size);
      if ("error" in grant) throw new Error(grant.error);
      const res = await fetch(grant.url, {
        method: "PUT",
        body: compressed,
        headers: { "Content-Type": "image/webp" },
      });
      if (!res.ok) throw new Error("Tải ảnh lên thất bại");
      setStatus({ state: "done", key: grant.key });
    } catch (e) {
      setStatus({ state: "error", message: e instanceof Error ? e.message : "Tải ảnh lên thất bại" });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {/* Input ẩn không được trình duyệt kiểm tra required → server báo lỗi khi thiếu ảnh. */}
      <input type="hidden" name={name} value={status.state === "done" ? status.key : ""} />
      <input
        ref={fileRef}
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
      <div
        className={`flex items-center gap-3 rounded-xl border-[1.5px] p-2.5 ${
          status.state === "done"
            ? "border-brand bg-brand-soft"
            : status.state === "error"
              ? "border-warn bg-warn-soft"
              : "border-dashed border-muted-foreground/50"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước từ blob cục bộ
          <img src={preview} alt="" className="size-14 shrink-0 rounded-lg border object-cover" />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted" aria-hidden>
            <Camera className="size-5 text-muted-foreground" />
          </span>
        )}
        <p className="flex-1 text-sm" aria-live="polite" role={status.state === "error" ? "alert" : undefined}>
          {status.state === "idle" && <span className="text-muted-foreground">Chưa có ảnh</span>}
          {status.state === "uploading" && <span className="text-muted-foreground">Đang tải ảnh…</span>}
          {status.state === "done" && <span className="font-semibold text-brand-ink">Đã tải ảnh</span>}
          {status.state === "error" && <span className="font-semibold text-warn-ink">{status.message}</span>}
        </p>
        {status.state === "error" && lastFile ? (
          <Button type="button" variant="outline" className="h-10 gap-1.5 rounded-lg" onClick={() => void upload(lastFile)}>
            <RotateCcw />
            Thử lại
          </Button>
        ) : (
          <Button
            type="button"
            variant={status.state === "idle" ? "default" : "outline"}
            className="h-10 gap-1.5 rounded-lg"
            onClick={() => fileRef.current?.click()}
          >
            <Camera />
            {status.state === "idle" ? "Chụp ảnh" : "Chụp lại"}
          </Button>
        )}
      </div>
    </div>
  );
}
