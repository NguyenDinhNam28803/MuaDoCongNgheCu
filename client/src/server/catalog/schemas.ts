import { z } from "zod";

export const PRODUCT_CATEGORIES = ["PHONE", "LAPTOP", "TABLET", "WATCH", "ACCESSORY", "OTHER"] as const;

export const CATEGORY_LABEL: Record<(typeof PRODUCT_CATEGORIES)[number], string> = {
  PHONE: "Điện thoại",
  LAPTOP: "Laptop",
  TABLET: "Máy tính bảng",
  WATCH: "Đồng hồ",
  ACCESSORY: "Phụ kiện",
  OTHER: "Khác",
};

const optionalText = z
  .string()
  .trim()
  .max(60)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const productInputSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên model").max(120),
  brand: z.string().trim().min(1, "Vui lòng nhập hãng").max(60),
  category: z.enum(PRODUCT_CATEGORIES),
});

export const variantInputSchema = z.object({
  storage: optionalText,
  ram: optionalText,
  color: optionalText,
  isSerialized: z.boolean(),
  referencePrice: z.bigint().nonnegative().nullable(),
  newPrice: z.bigint().nonnegative().nullable(),
});

export type ProductInput = z.input<typeof productInputSchema>;
export type VariantInput = z.input<typeof variantInputSchema>;
