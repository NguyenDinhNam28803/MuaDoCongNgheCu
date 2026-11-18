/** Lỗi nghiệp vụ nhập máy / kho; thông điệp hiển thị thẳng cho người dùng. */
export class IntakeRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntakeRuleError";
  }
}
