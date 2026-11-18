"use client";

// Navbar website TECNOVA. Máy tính: dải cam kết + một hàng (logo · danh mục · Bán máy cũ · tìm kiếm).
// Điện thoại: 2 tầng gọn (logo · Zalo · menu / ô tìm kiếm); danh mục nằm trong menu trượt.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Headphones, Laptop, Menu, MessageCircle, Phone, Recycle, Search, ShieldCheck, Smartphone, Tablet, Watch } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  { href: "/may?category=PHONE", label: "Điện thoại", icon: Smartphone },
  { href: "/may?category=LAPTOP", label: "Laptop", icon: Laptop },
  { href: "/may?category=TABLET", label: "Máy tính bảng", icon: Tablet },
  { href: "/may?category=WATCH", label: "Đồng hồ", icon: Watch },
  { href: "/phu-kien", label: "Phụ kiện", icon: Headphones },
];

type ShopContact = { name: string; phone: string; zalo: string; hours: string };

function SearchBox({ className = "" }: { className?: string }) {
  return (
    <form
      action="/may"
      method="get"
      role="search"
      className={`flex h-11 items-center gap-2 rounded-full border-[1.5px] bg-background px-4 focus-within:border-ink focus-within:bg-card ${className}`}
    >
      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        name="q"
        type="search"
        aria-label="Tìm sản phẩm"
        placeholder="Tìm iPhone, MacBook…"
        className="h-full w-full min-w-0 bg-transparent text-base outline-none"
      />
    </form>
  );
}

function NavLinks({ pathname }: { pathname: string | null }) {
  const isActive = (href: string) => {
    const path = href.split("?")[0];
    return path !== "/may" && pathname === path;
  };
  return (
    <>
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={isActive(n.href) ? "page" : undefined}
          className={`relative rounded-lg px-3 py-2 text-[15px] font-semibold transition hover:bg-muted ${
            isActive(n.href) ? "text-brand after:absolute after:inset-x-3 after:-bottom-3.25 after:h-0.5 after:bg-brand" : ""
          }`}
        >
          {n.label}
        </Link>
      ))}
    </>
  );
}

/** usePathname là dữ liệu theo request → nằm sau Suspense (Cache Components); lúc chờ hiện link không gạch chân. */
function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

export function ShopHeader({ shop }: { shop: ShopContact }) {
  const zalo = `https://zalo.me/${shop.zalo}`;

  return (
    <header className="sticky top-0 z-30">
      {/* Dải cam kết — chỉ màn rộng */}
      <div className="hidden bg-ink text-[13px] text-white/80 md:block">
        <div className="mx-auto flex h-9 max-w-6xl items-center justify-between gap-4 px-4">
          <p className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-brand-bright" aria-hidden />
            Mỗi máy cũ đều có hộ chiếu kiểm định · Đổi trả 7 ngày
          </p>
          <p className="flex items-center gap-4">
            <a href={`tel:${shop.phone}`} className="flex items-center gap-1.5 hover:text-white">
              <Phone className="size-3.5" aria-hidden />
              {shop.phone}
            </a>
            <a href={zalo} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-white">
              <MessageCircle className="size-3.5" aria-hidden />
              Zalo
            </a>
          </p>
        </div>
      </div>

      <div className="border-b bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-2.5 md:flex-nowrap md:gap-6 md:py-3">
          <Link href="/" aria-label={`${shop.name} — trang chủ`} className="shrink-0">
            <Logo name={shop.name} size={32} textClassName="text-xl md:text-2xl" />
          </Link>

          <nav aria-label="Danh mục" className="hidden items-center gap-1 lg:flex">
            <Suspense fallback={<NavLinks pathname={null} />}>
              <ActiveNavLinks />
            </Suspense>
          </nav>

          {/* Một ô tìm kiếm: điện thoại xuống hàng riêng (order-last), màn rộng nằm cùng hàng */}
          <SearchBox className="order-last basis-full md:order-0 md:ml-auto md:max-w-xs md:basis-auto md:flex-1" />

          <Link
            href="/#thu-cu"
            className="hidden h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-soft px-4 text-sm font-bold text-brand-ink hover:bg-brand hover:text-white md:inline-flex"
          >
            <Recycle className="size-4" aria-hidden />
            Bán máy cũ
          </Link>

          {/* Điện thoại: Zalo + menu */}
          <div className="ml-auto flex items-center gap-1.5 md:hidden">
            <a
              href={zalo}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Nhắn Zalo cho cửa hàng"
              className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"
            >
              <MessageCircle className="size-5" aria-hidden />
            </a>
            <Sheet>
              <SheetTrigger
                render={<button type="button" aria-label="Mở menu" className="flex size-11 items-center justify-center rounded-xl bg-ink text-white" />}
              >
                <Menu className="size-5" aria-hidden />
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-3xl p-0">
                <SheetHeader className="border-b px-5 py-4">
                  <SheetTitle className="text-left">Danh mục</SheetTitle>
                </SheetHeader>
                <nav aria-label="Danh mục" className="grid grid-cols-2 gap-2 p-4">
                  {NAV.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href} className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-3.5 font-semibold">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                        <Icon className="size-4.5" aria-hidden />
                      </span>
                      {label}
                    </Link>
                  ))}
                  <Link href="/#thu-cu" className="flex min-h-14 items-center gap-3 rounded-2xl bg-ink px-3.5 font-semibold text-white">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-brand-bright">
                      <Recycle className="size-4.5" aria-hidden />
                    </span>
                    Bán máy cũ
                  </Link>
                </nav>
                <div className="flex flex-col gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <a href={`tel:${shop.phone}`} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink font-bold text-white">
                    <Phone className="size-4" aria-hidden />
                    Gọi {shop.phone}
                  </a>
                  <p className="text-center text-xs text-muted-foreground">{shop.hours}</p>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
