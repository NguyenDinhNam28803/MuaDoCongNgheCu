"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePasswordAction, setActiveAction, type FormState } from "./actions";

type Props = {
  id: string;
  name: string;
  phone: string;
  roleLabel: string;
  active: boolean;
  isSelf: boolean;
};

export function UserRow({ id, name, phone, roleLabel, active, isSelf }: Props) {
  const [toggleState, toggleAction, toggling] = useActionState<FormState, FormData>(
    () => setActiveAction(id, !active),
    {},
  );
  const [pwState, pwAction, savingPw] = useActionState<FormState, FormData>(
    changePasswordAction.bind(null, id),
    {},
  );
  const [showPw, setShowPw] = useState(false);
  const error = toggleState.error ?? pwState.error;

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-sm text-muted-foreground">
            {phone} · {roleLabel}
          </p>
        </div>
        <span className={`text-xs ${active ? "text-emerald-700" : "text-destructive"}`}>
          {active ? "Đang hoạt động" : "Đã khóa"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {!isSelf && (
          <form action={toggleAction}>
            <Button type="submit" variant="outline" size="sm" disabled={toggling}>
              {active ? "Khóa" : "Mở khóa"}
            </Button>
          </form>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowPw((v) => !v)}>
          Đổi mật khẩu
        </Button>
      </div>

      {showPw && (
        <form action={pwAction} className="flex gap-2">
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            aria-label={`Mật khẩu mới cho ${name}`}
            className="h-10"
          />
          <Button type="submit" size="sm" disabled={savingPw} className="h-10">
            Lưu
          </Button>
        </form>
      )}
      {pwState.ok && <p className="text-sm text-emerald-700">Đã đổi mật khẩu</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}
