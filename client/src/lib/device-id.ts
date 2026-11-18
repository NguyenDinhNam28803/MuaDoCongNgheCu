// IMEI (15 số, Luhn) và serial. Hàm thuần, dùng cả client (máy quét) và server (kiểm tra lại).

export function isValidImei(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = imei.charCodeAt(i) - 48;
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function normalizeImei(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  return isValidImei(digits) ? digits : null;
}

/**
 * Lấy IMEI hợp lệ đầu tiên từ chuỗi quét/dán: "IMEI: 49 015420 323751 8",
 * "IMEI1 … IMEI2 …", hai IMEI liền nhau "…/…" hoặc cách nhau dấu cách.
 */
export function extractImei(scanned: string): string | null {
  for (const [run] of scanned.matchAll(/\d(?:[\d \t-]*\d)?/g)) {
    const digits = run.replace(/\D/g, "");
    const candidates: string[] = [];
    if (digits.length === 15) {
      candidates.push(digits);
    } else {
      for (const token of run.split(/[\s-]+/)) if (token.length === 15) candidates.push(token);
      if (digits.length === 30) candidates.push(digits.slice(0, 15), digits.slice(15));
    }
    const found = candidates.find(isValidImei);
    if (found) return found;
  }
  return null;
}

/** Serial laptop/máy tính bảng: bỏ tiền tố "SN:", khoảng trắng, gạch; viết hoa; 8–20 ký tự chữ-số. */
export function normalizeSerial(input: string): string | null {
  const s = input
    .trim()
    .replace(/^(s\/?n|serial(\s*no\.?)?)\s*[:#]?\s*/i, "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
  return /^[A-Z0-9]{8,20}$/.test(s) ? s : null;
}

export type ParsedIdentifier = { imei: string } | { serial: string } | { error: string };

/** Ô "IMEI hoặc serial": chuỗi số (có thể kèm nhãn "IMEI") → IMEI; có chữ cái → serial. */
export function parseIdentifier(input: string): ParsedIdentifier {
  if (!input.trim()) return { error: "Nhập IMEI hoặc serial" };
  const imei = extractImei(input);
  if (imei) return { imei };
  const looksNumeric = !/[a-z]/i.test(input.replace(/imei\d?/gi, "")) && /\d/.test(input);
  if (looksNumeric) return { error: "IMEI không hợp lệ" };
  const serial = normalizeSerial(input);
  return serial ? { serial } : { error: "IMEI/serial không hợp lệ" };
}
