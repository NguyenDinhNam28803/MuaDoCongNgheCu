"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, MoreHorizontal } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { logoutAction } from "../login/actions";

type Item = { href: string; label: string };

const BOTTOM_COUNT = 4;

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="outline" className="h-11 w-full justify-start gap-2">
        <LogOut />
        Đăng xuất
      </Button>
    </form>
  );
}

export function AdminNav({ items, userName, roleLabel }: { items: Item[]; userName: string; roleLabel: string }) {
  const pathname = usePathname();
  const bottom = items.slice(0, BOTTOM_COUNT);
  const rest = items.slice(BOTTOM_COUNT);

  const linkClass = (href: string) =>
    isActive(pathname, href) ? "text-brand font-semibold" : "text-muted-foreground";

  return (
    <>
      {/* Màn hình rộng: sidebar trái */}
      <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r bg-surface p-4 md:flex">
        <div className="mb-4 flex flex-col gap-3">
          <Logo size={30} textClassName="text-lg" />
          <div>
          <p className="text-sm font-semibold">{userName}</p>
          <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
        <nav aria-label="Điều hướng quản trị" className="flex flex-col gap-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 hover:bg-muted ${isActive(pathname, item.href) ? "bg-brand-soft" : ""} ${linkClass(item.href)}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-4">
          <LogoutButton />
        </div>
      </aside>

      {/* Điện thoại: header gọn + thanh điều hướng đáy */}
      <header className="flex items-center justify-between border-b bg-surface px-4 py-3 md:hidden">
        <Logo size={28} textClassName="text-lg" />
        <div className="text-right">
          <p className="text-sm leading-tight">{userName}</p>
          <p className="text-xs text-muted-foreground">{roleLabel}</p>
        </div>
      </header>
      <nav
        aria-label="Điều hướng chính"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {bottom.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex h-14 items-center justify-center px-1 text-center text-xs ${linkClass(item.href)}`}
          >
            {item.label}
          </Link>
        ))}
        <Sheet>
          <SheetTrigger
            render={
              <button
                type="button"
                className="flex h-14 flex-col items-center justify-center text-xs text-muted-foreground"
              />
            }
          >
            <MoreHorizontal className="size-4" aria-hidden />
            Thêm
          </SheetTrigger>
          <SheetContent side="bottom" className="p-4">
            <SheetHeader className="p-0">
              <SheetTitle>Thêm</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1">
              {rest.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-3 hover:bg-muted ${linkClass(item.href)}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <LogoutButton />
          </SheetContent>
        </Sheet>
      </nav>
    </>
  );
}
