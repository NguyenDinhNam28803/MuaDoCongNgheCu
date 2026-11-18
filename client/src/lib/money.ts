// Tiền VND là bigint. Hàm thuần, dùng được cả client và server.

const UNIT_MULTIPLIER: Record<string, bigint> = {
  tr: 1_000_000n,
  "triệu": 1_000_000n,
  trieu: 1_000_000n,
  k: 1_000n,
  "nghìn": 1_000n,
  nghin: 1_000n,
  "ngàn": 1_000n,
  ngan: 1_000n,
};

const WITH_UNIT = /^(\d+)(?:[.,](\d{1,3}))?(tr|triệu|trieu|k|nghìn|nghin|ngàn|ngan)$/;
const PLAIN = /^(\d+|\d{1,3}(?:\.\d{3})+)$/;

/**
 * Hiểu cách gõ giá thường ngày: "15.500.000", "15 500 000", "15tr", "15,5tr", "500k".
 * Không đơn vị thì "." là phân cách nghìn và chỉ nhận số nguyên. Không hiểu được → null.
 */
export function parseVndInput(input: string): bigint | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;

  const unit = WITH_UNIT.exec(s);
  if (unit) {
    const [, whole, fraction = "", suffix] = unit;
    const multiplier = UNIT_MULTIPLIER[suffix];
    const scale = 10n ** BigInt(fraction.length);
    return (BigInt(whole + fraction) * multiplier) / scale;
  }

  if (PLAIN.test(s)) return BigInt(s.replace(/\./g, ""));
  return null;
}

const vnNumber = new Intl.NumberFormat("vi-VN");

export function formatVnd(amount: bigint | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `${vnNumber.format(amount)} ₫`;
}
