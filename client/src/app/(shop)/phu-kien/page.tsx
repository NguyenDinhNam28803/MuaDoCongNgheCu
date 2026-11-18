import type { Metadata } from "next";
import { formatVnd } from "@/lib/money";
import { accessoryList, shopInfo } from "@/lib/shop-data";

export const metadata: Metadata = { title: "Phụ kiện", description: "Ốp lưng, cường lực, sạc, cáp và phụ kiện công nghệ." };

export default async function AccessoriesPage() {
  const [items, shop] = await Promise.all([accessoryList(), shopInfo()]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Phụ kiện</h1>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Phụ kiện đang được cập nhật.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((a) => (
            <li key={a.id} className="rounded-xl border p-3 text-sm">
              <p className="font-medium">{a.name}</p>
              {a.label !== "Mặc định" && <p className="text-xs text-muted-foreground">{a.label}</p>}
              <p className="mt-1 font-semibold">{formatVnd(a.price)}</p>
              <p className="text-xs text-muted-foreground">Còn {a.inStock}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted-foreground">
        Mua phụ kiện tại cửa hàng hoặc nhắn Zalo{" "}
        <a className="underline" href={`https://zalo.me/${shop.zalo}`} target="_blank" rel="noopener noreferrer">
          {shop.zalo}
        </a>
        .
      </p>
    </div>
  );
}
