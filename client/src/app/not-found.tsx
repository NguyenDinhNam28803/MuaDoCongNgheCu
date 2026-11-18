import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold">Không tìm thấy trang</h1>
      <p className="text-sm text-muted-foreground">Trang không tồn tại hoặc bạn không có quyền xem.</p>
      <Link href="/" className="text-sm underline underline-offset-4">
        Về trang chủ
      </Link>
    </main>
  );
}
