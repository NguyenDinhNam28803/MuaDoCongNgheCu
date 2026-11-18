"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { viewIdDocAction } from "../actions";

export function IdDocButton({ deviceId }: { deviceId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          // Mở tab ngay trong sự kiện bấm để không bị chặn popup, rồi gán URL ký sau.
          const tab = window.open("", "_blank");
          start(async () => {
            const r = await viewIdDocAction(deviceId);
            if ("url" in r && tab) {
              tab.location.href = r.url;
            } else {
              tab?.close();
              setError("error" in r ? r.error : "Không mở được ảnh");
            }
          });
        }}
      >
        Xem giấy tờ
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
