// Suspense boundary cho mọi trang quản trị: trang đọc phiên/DB stream vào sau khung (Cache Components).
export default function AdminLoading() {
  return <p className="text-sm text-muted-foreground">Đang tải…</p>;
}
