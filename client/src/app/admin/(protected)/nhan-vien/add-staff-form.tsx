"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStaffAction, type FormState } from "./actions";

export function AddStaffForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createStaffAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="staff-name">Tên nhân viên</Label>
        <Input id="staff-name" name="name" required className="h-11 text-base" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="staff-phone">Số điện thoại</Label>
        <Input id="staff-phone" name="phone" type="tel" inputMode="tel" required className="h-11 text-base" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="staff-password">Mật khẩu</Label>
        <Input
          id="staff-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="h-11 text-base"
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Đang thêm…" : "Thêm nhân viên"}
      </Button>
    </form>
  );
}
