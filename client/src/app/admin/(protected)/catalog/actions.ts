"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { ProductCategory } from "@/generated/prisma/enums";
import { parseVndInput } from "@/lib/money";
import { requirePermission } from "@/lib/auth/dal";
import { prisma } from "@/server/db";
import { CatalogRuleError } from "@/server/catalog/errors";
import {
  addVariant,
  createProduct,
  deleteVariant,
  setArchived,
  updateProduct,
  updateVariant,
  type ProductInput,
  type VariantInput,
} from "@/server/catalog/products";
import { adjustAccessoryStock } from "@/server/catalog/stock";

export type FormState = { error?: string; ok?: boolean };

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function price(fd: FormData, key: string): bigint | null {
  const raw = text(fd, key);
  if (!raw) return null;
  const v = parseVndInput(raw);
  if (v === null) throw new CatalogRuleError("Giá không hợp lệ");
  return v;
}

function productFromForm(fd: FormData): ProductInput {
  return { name: text(fd, "name"), brand: text(fd, "brand"), category: text(fd, "category") as ProductCategory };
}

function variantFromForm(fd: FormData, isSerialized: boolean): VariantInput {
  return {
    storage: text(fd, "storage"),
    ram: text(fd, "ram"),
    color: text(fd, "color"),
    isSerialized,
    referencePrice: price(fd, "referencePrice"),
    newPrice: price(fd, "newPrice"),
  };
}

async function run(productId: string | null, fn: () => Promise<void>): Promise<FormState> {
  await requirePermission("catalog.manage");
  try {
    await fn();
  } catch (e) {
    if (e instanceof CatalogRuleError) return { error: e.message };
    throw e;
  }
  updateTag("devices"); // tên model, ẩn/hiện, tồn phụ kiện hiển thị trên website
  revalidatePath("/admin/catalog");
  if (productId) revalidatePath(`/admin/catalog/${productId}`);
  return { ok: true };
}

export async function createProductAction(_prev: FormState, fd: FormData): Promise<FormState> {
  let productId = "";
  const state = await run(null, async () => {
    const isSerialized = fd.get("accessory") !== "on";
    ({ productId } = await createProduct(prisma, { ...productFromForm(fd), firstVariant: variantFromForm(fd, isSerialized) }));
  });
  if (state.error) return state;
  redirect(`/admin/catalog/${productId}`);
}

export async function updateProductAction(productId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  return run(productId, () => updateProduct(prisma, productId, productFromForm(fd)));
}

export async function addVariantAction(productId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  return run(productId, async () => {
    await addVariant(prisma, productId, variantFromForm(fd, fd.get("isSerialized") === "true"));
  });
}

export async function updateVariantAction(
  productId: string,
  variantId: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  return run(productId, () => updateVariant(prisma, variantId, variantFromForm(fd, fd.get("isSerialized") === "true")));
}

export async function setProductArchivedAction(productId: string, archived: boolean): Promise<FormState> {
  return run(productId, () => setArchived(prisma, { productId }, archived));
}

export async function setVariantArchivedAction(productId: string, variantId: string, archived: boolean): Promise<FormState> {
  return run(productId, () => setArchived(prisma, { variantId }, archived));
}

export async function deleteVariantAction(productId: string, variantId: string): Promise<FormState> {
  return run(productId, () => deleteVariant(prisma, variantId));
}

export async function adjustStockAction(
  productId: string,
  variantId: string,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  return run(productId, async () => {
    const qty = Number(text(fd, "qty"));
    if (!Number.isInteger(qty) || qty <= 0) throw new CatalogRuleError("Số lượng phải là số nguyên dương");
    await adjustAccessoryStock(prisma, variantId, fd.get("op") === "out" ? -qty : qty);
  });
}
