// Lọc tham số ?next= để chống chuyển hướng mở (open redirect). Hàm thuần.
const ADMIN_PATH = /^\/admin(\/[A-Za-z0-9\-_/]*)?$/;

export function safeNextPath(input: string | null | undefined): string {
  if (!input || input.includes("..") || !ADMIN_PATH.test(input)) return "/admin";
  return input;
}
