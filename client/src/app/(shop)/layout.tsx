import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { ShopHeader } from "@/components/shop/shop-header";
import { shopInfo } from "@/lib/shop-data";

export default async function ShopLayout({ children }: LayoutProps<"/">) {
  const shop = await shopInfo();
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <ShopHeader shop={{ name: shop.name, phone: shop.phone, zalo: shop.zalo, hours: shop.hours }} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t bg-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm leading-relaxed sm:grid-cols-3">
          <div>
            <Wordmark name={shop.name} className="text-xl" />
            <p className="mt-1 text-muted-foreground">{shop.address}</p>
            <p className="text-muted-foreground">{shop.hours}</p>
          </div>
          <div className="flex flex-col">
            <a href={`tel:${shop.phone}`} className="hover:text-brand">
              Gọi: {shop.phone}
            </a>
            <a href={`https://zalo.me/${shop.zalo}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand">
              Zalo: {shop.zalo}
            </a>
          </div>
          <div className="flex flex-col">
            <Link href="/chinh-sach" className="hover:text-brand">
              Chính sách bảo hành, đổi trả
            </Link>
            <Link href="/chinh-sach#hang-may" className="hover:text-brand">
              Tiêu chí phân hạng máy
            </Link>
            <Link href="/chinh-sach#quyen-rieng-tu" className="hover:text-brand">
              Quyền riêng tư
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
