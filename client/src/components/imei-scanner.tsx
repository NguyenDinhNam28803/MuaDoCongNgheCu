"use client";

import type { IScannerControls } from "@zxing/browser";
import { ScanLine, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { extractImei } from "@/lib/device-id";

/**
 * Quét mã vạch IMEI bằng camera sau (vd. màn hình *#06# hoặc tem hộp máy).
 * Chỉ gọi onDetected khi đọc được IMEI hợp lệ (Luhn). Không mở được camera → báo gõ tay.
 */
export function ImeiScanner({ onDetected }: { onDetected: (imei: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-camera");
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current ?? undefined,
          (result) => {
            const imei = result ? extractImei(result.getText()) : null;
            if (imei) {
              controlsRef.current?.stop();
              setOpen(false);
              onDetected(imei);
            }
          },
        );
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
      } catch {
        if (!cancelled) {
          setError("Không mở được camera, hãy nhập IMEI bằng tay");
          setOpen(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetected]);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-11 gap-2"
        onClick={() => {
          setError(null);
          setOpen((o) => !o);
        }}
      >
        {open ? <X /> : <ScanLine />}
        {open ? "Tắt camera" : "Quét mã"}
      </Button>
      {open && (
        <video ref={videoRef} className="aspect-video w-full rounded-md bg-black object-cover" muted playsInline />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
