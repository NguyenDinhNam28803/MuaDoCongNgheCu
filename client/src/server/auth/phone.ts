/** Chuẩn hóa SĐT Việt Nam về dạng 0xxxxxxxxx (10 số). Không hợp lệ → null. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length === 11) digits = `0${digits.slice(2)}`;
  return /^0\d{9}$/.test(digits) ? digits : null;
}
