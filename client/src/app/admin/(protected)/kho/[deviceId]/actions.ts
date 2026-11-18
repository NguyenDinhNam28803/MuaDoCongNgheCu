"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { Grade } from "@/generated/prisma/enums";
import { requirePermission, requireUser } from "@/lib/auth/dal";
import { parseVndInput } from "@/lib/money";
import { prisma } from "@/server/db";
import { ForbiddenError } from "@/server/auth/permissions";
import { DeviceConflictError } from "@/server/devices/errors";
import { InspectionRuleError } from "@/server/inspection/errors";
import {
  finishRefurbish,
  startInspection,
  submitInspection,
  updateListPrice,
  type InspectionDecision,
} from "@/server/inspection/service";
import { checklistFor, type ChecklistResultValue } from "@/server/inspection/templates";

export type FormState = { error?: string; ok?: boolean };

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function optionalInt(fd: FormData, key: string): number | null {
  const raw = text(fd, key);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new InspectionRuleError("% pin không hợp lệ");
  return n;
}

function price(fd: FormData, key: string, required: boolean): bigint | null {
  const raw = text(fd, key);
  if (!raw) {
    if (required) throw new InspectionRuleError("Nhập giá bán");
    return null;
  }
  const v = parseVndInput(raw);
  if (v === null) throw new InspectionRuleError("Giá không hợp lệ");
  return v;
}

function yesNo(fd: FormData, key: string, question: string): boolean {
  const v = text(fd, key);
  if (v !== "yes" && v !== "no") throw new InspectionRuleError(`Trả lời câu hỏi: ${question}`);
  return v === "yes";
}

function refresh(deviceId: string) {
  // Website công khai đọc máy qua cache tag "devices".
  updateTag("devices");
  revalidatePath("/admin/kho");
  revalidatePath(`/admin/kho/${deviceId}`);
}

async function run(deviceId: string, fn: () => Promise<void>): Promise<FormState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof InspectionRuleError || e instanceof ForbiddenError) return { error: e.message };
    if (e instanceof DeviceConflictError) return { error: "Máy vừa được người khác cập nhật, vui lòng tải lại trang" };
    throw e;
  }
  refresh(deviceId);
  return { ok: true };
}

export async function startInspectionAction(deviceId: string): Promise<FormState> {
  const user = await requirePermission("device.inspect");
  const state = await run(deviceId, () => startInspection(prisma, user, deviceId));
  if (state.error) return state;
  redirect(`/admin/kho/${deviceId}/kiem-dinh`);
}

export async function submitInspectionAction(
  deviceId: string,
  category: Parameters<typeof checklistFor>[0],
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requirePermission("device.inspect");
  const state = await run(deviceId, async () => {
    const decision = text(fd, "decision") as InspectionDecision;
    if (!["LIST", "REFURBISH", "REJECT"].includes(decision)) throw new InspectionRuleError("Chọn kết quả kiểm định");
    const checklist = checklistFor(category).map((item) => {
      const result = text(fd, `check-${item.key}`) as ChecklistResultValue;
      if (!result) throw new InspectionRuleError(`Chưa chấm mục: ${item.label}`);
      return { key: item.key, label: item.label, result, note: text(fd, `note-${item.key}`) || undefined };
    });
    const grade = text(fd, "grade");
    await submitInspection(prisma, user, deviceId, {
      checklist,
      batteryPct: optionalInt(fd, "batteryPct"),
      grade: grade ? (grade as Grade) : null,
      replacedParts: fd.getAll("replacedParts").map(String),
      regionCode: text(fd, "regionCode") || null,
      photoKeys: fd.getAll("photoKeys").map(String).filter(Boolean),
      accountLocked: yesNo(fd, "accountLocked", "máy còn khóa tài khoản?"),
      dataWiped: yesNo(fd, "dataWiped", "đã xóa dữ liệu?"),
      isRefurbished: fd.get("isRefurbished") === "on",
      notes: text(fd, "notes") || null,
      decision,
      listPrice: decision === "LIST" ? price(fd, "listPrice", true) : null,
    });
  });
  if (state.error) return state;
  redirect(`/admin/kho/${deviceId}`);
}

export async function finishRefurbishAction(deviceId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("device.inspect");
  return run(deviceId, async () => {
    await finishRefurbish(prisma, user, deviceId, {
      cost: price(fd, "cost", false) ?? 0n,
      note: text(fd, "note") || null,
      listPrice: price(fd, "listPrice", true)!,
      batteryPct: optionalInt(fd, "batteryPct"),
    });
  });
}

export async function updatePriceAction(deviceId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  return run(deviceId, async () => {
    await updateListPrice(prisma, user, deviceId, price(fd, "price", true)!);
  });
}
