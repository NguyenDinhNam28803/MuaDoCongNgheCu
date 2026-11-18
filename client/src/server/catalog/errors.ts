/** Lỗi nghiệp vụ catalog; thông điệp hiển thị thẳng cho người dùng. */
export class CatalogRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogRuleError";
  }
}
