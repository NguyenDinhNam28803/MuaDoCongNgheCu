"use server";

import { revalidatePath } from "next/cache";
import type { AcquisitionType, Condition } from "@/generated/prisma/enums";
import { parseVndInput } from "@/lib/money";
import { parseIdentifier } from "@/lib/device-id";
import { requirePermission } from "@/lib/auth/dal";
import { prisma } from "@/server/db";
import { searchVariants, type VariantSearchResult } from "@/server/catalog/products";
import { IntakeRuleError } from "@/server/inventory/errors";
import { checkIdentifier, intakeDevices, type IdentifierCheck, type IntakeDeviceInput } from "@/server/inventory/intake";

export type IdentifierResult =
  | { error: string }
  | { kind: "imei" | "serial"; value: string; check: IdentifierCheck };

export async function checkIdentifierAction(raw: string): Promise<IdentifierResult> {
  await requirePermission("device.intake");
  const parsed = parseIdentifier(raw);
  if ("error" in parsed) return parsed;
  const check = await checkIdentifier(prisma, parsed);
  return "imei" in parsed
    ? { kind: "imei", value: parsed.imei, check }
    : { kind: "serial", value: parsed.serial, check };
}

export async function searchVariantsAction(q: string): Promise<VariantSearchResult[]> {
  await requirePermission("device.intake");
  return searchVariants(prisma, q, { serializedOnly: true });
}

export type IntakeState = {
  error?: string;
  warnings?: string[];
  done?: { acquisitionId: string; count: number };
};

const TYPES: AcquisitionType[] = ["TRADE_IN", "WHOLESALE", "NEW_STOCK"];
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function intakeAction(_prev: IntakeState, fd: FormData): Promise<IntakeState> {
  const actor = await requirePermission("device.intake");
  const type = text(fd, "type") as AcquisitionType;
  if (!TYPES.includes(type)) return { error: "Chọn nguồn nhập" };

  try {
    const devices: IntakeDeviceInput[] = fd.getAll("row").map((value, i) => {
      const row = String(value);
      const id = parseIdentifier(text(fd, `identifier-${row}`));
      if ("error" in id) throw new IntakeRuleError(`Máy thứ ${i + 1}: ${id.error}`);
      const price = parseVndInput(text(fd, `price-${row}`));
      if (price === null) throw new IntakeRuleError(`Máy thứ ${i + 1}: giá nhập không hợp lệ`);
      const variantId = text(fd, `variant-${row}`);
      if (!variantId) throw new IntakeRuleError(`Máy thứ ${i + 1}: chọn model`);
      return {
        variantId,
        ...id,
        condition: (text(fd, `condition-${row}`) === "NEW" ? "NEW" : "USED") as Condition,
        costPrice: price,
      };
    });

    const result = await intakeDevices(prisma, actor, {
      type,
      seller:
        type === "TRADE_IN"
          ? {
              name: text(fd, "sellerName"),
              phone: text(fd, "sellerPhone"),
              idDocKey: text(fd, "idDocKey"),
              originPledged: fd.get("originPledged") === "on",
              consent: fd.get("consent") === "on",
            }
          : undefined,
      sourceName: text(fd, "sourceName"),
      note: text(fd, "note"),
      devices,
    });
    revalidatePath("/admin/kho");
    return { done: { acquisitionId: result.acquisitionId, count: result.deviceIds.length }, warnings: result.warnings };
  } catch (e) {
    if (e instanceof IntakeRuleError) return { error: e.message };
    throw e;
  }
}
