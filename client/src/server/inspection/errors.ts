/** Lỗi nghiệp vụ kiểm định; thông điệp hiển thị thẳng cho người dùng. */
export class InspectionRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InspectionRuleError";
  }
}
