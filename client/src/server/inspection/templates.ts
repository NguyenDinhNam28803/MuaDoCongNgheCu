// Mẫu checklist kiểm định ("hộ chiếu thiết bị"). Hàm thuần, dùng cả server và giao diện.
// Đổi nội dung mẫu → tăng TEMPLATE_VERSION (báo cáo cũ giữ phiên bản của nó).
import type { Grade, ProductCategory } from "@/generated/prisma/enums";

export const TEMPLATE_VERSION = 1;

export type ChecklistItem = { key: string; label: string };
export type ChecklistResultValue = "ok" | "issue" | "na";
export type ChecklistResult = { key: string; label: string; result: ChecklistResultValue; note?: string };

const PHONE: ChecklistItem[] = [
  { key: "power", label: "Lên nguồn, khởi động bình thường" },
  { key: "display", label: "Màn hình: không điểm chết, ám, sọc" },
  { key: "touch", label: "Cảm ứng đủ mọi vùng" },
  { key: "true_tone", label: "True Tone / độ sáng tự động" },
  { key: "face_id", label: "Face ID / vân tay" },
  { key: "camera_rear", label: "Camera sau (chụp, lấy nét, quay)" },
  { key: "camera_front", label: "Camera trước" },
  { key: "speaker_mic", label: "Loa trong, loa ngoài, micro" },
  { key: "buttons", label: "Nút nguồn, âm lượng, gạt rung" },
  { key: "charging", label: "Sạc dây (và sạc không dây nếu có)" },
  { key: "sim", label: "Nhận SIM, nghe gọi, 4G/5G" },
  { key: "wifi_bt", label: "Wi-Fi, Bluetooth, GPS" },
  { key: "sensors", label: "Cảm biến tiệm cận, xoay màn hình" },
  { key: "housing", label: "Vỏ, khung: không cong, nứt" },
];

const LAPTOP: ChecklistItem[] = [
  { key: "power", label: "Lên nguồn, vào hệ điều hành" },
  { key: "display", label: "Màn hình: không điểm chết, ám, hở sáng" },
  { key: "keyboard", label: "Bàn phím đủ phím, đèn nền" },
  { key: "trackpad", label: "Touchpad / bấm, cuộn, cử chỉ" },
  { key: "battery_cycles", label: "Pin: số lần sạc, giữ pin" },
  { key: "charging", label: "Sạc qua cổng sạc" },
  { key: "ports", label: "Các cổng USB/HDMI/thẻ nhớ" },
  { key: "speaker_mic", label: "Loa, micro, jack tai nghe" },
  { key: "webcam", label: "Webcam" },
  { key: "wifi_bt", label: "Wi-Fi, Bluetooth" },
  { key: "storage_health", label: "Ổ cứng: sức khỏe, không lỗi" },
  { key: "thermal", label: "Quạt, nhiệt độ khi tải nặng" },
  { key: "hinge", label: "Bản lề chắc, không lỏng" },
  { key: "housing", label: "Vỏ: không nứt, móp" },
];

const WATCH: ChecklistItem[] = [
  { key: "power", label: "Lên nguồn bình thường" },
  { key: "display", label: "Màn hình, cảm ứng" },
  { key: "crown_buttons", label: "Núm xoay, nút bấm" },
  { key: "sensors", label: "Cảm biến nhịp tim / SpO2" },
  { key: "charging", label: "Sạc" },
  { key: "pairing", label: "Ghép nối điện thoại" },
  { key: "speaker_mic", label: "Loa, micro" },
  { key: "water_seal", label: "Gioăng, kính mặt sau" },
  { key: "strap", label: "Dây đeo, chốt" },
  { key: "housing", label: "Vỏ: không nứt, cấn" },
];

const GENERIC: ChecklistItem[] = [
  { key: "power", label: "Hoạt động / lên nguồn" },
  { key: "function", label: "Chức năng chính hoạt động đúng" },
  { key: "connectivity", label: "Kết nối (cổng, Bluetooth, Wi-Fi…)" },
  { key: "charging", label: "Sạc / pin (nếu có)" },
  { key: "accessories", label: "Phụ kiện đi kèm" },
  { key: "housing", label: "Ngoại hình: không nứt, vỡ" },
];

export function checklistFor(category: ProductCategory): ChecklistItem[] {
  switch (category) {
    case "PHONE":
    case "TABLET":
      return PHONE;
    case "LAPTOP":
      return LAPTOP;
    case "WATCH":
      return WATCH;
    default:
      return GENERIC;
  }
}

/** Tiêu chí hạng — hiển thị cho nhân viên khi chấm và cho khách ở trang chính sách. */
export const GRADE_CRITERIA: Record<Grade, string> = {
  A: "Như mới: không trầy xước nhìn thấy ở khoảng cách 30 cm, mọi chức năng đạt, pin từ 85% trở lên.",
  B: "Trầy xước nhẹ ở vỏ hoặc viền, màn hình không vết, mọi chức năng đạt, pin từ 80% trở lên.",
  C: "Trầy xước, cấn móp rõ hoặc pin dưới 80%; chức năng chính đạt, các lỗi nhỏ được ghi rõ trong báo cáo.",
};

const PARTS: Record<"PHONE" | "LAPTOP" | "OTHER", string[]> = {
  PHONE: ["Màn hình", "Pin", "Camera sau", "Camera trước", "Loa", "Vỏ / khung", "Cụm Face ID", "Chân sạc"],
  LAPTOP: ["Màn hình", "Pin", "Bàn phím", "Touchpad", "Ổ cứng", "Sạc", "Quạt tản nhiệt", "Bản lề"],
  OTHER: ["Màn hình", "Pin", "Vỏ", "Dây đeo"],
};

export function partsFor(category: ProductCategory): string[] {
  if (category === "PHONE" || category === "TABLET") return PARTS.PHONE;
  if (category === "LAPTOP") return PARTS.LAPTOP;
  return PARTS.OTHER;
}
