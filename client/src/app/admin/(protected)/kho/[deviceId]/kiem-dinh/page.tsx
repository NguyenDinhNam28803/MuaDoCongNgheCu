import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { prisma } from "@/server/db";
import { variantLabel } from "@/server/catalog/products";
import { InspectionForm } from "./inspection-form";

export const metadata: Metadata = { title: "Kiểm định" };

export default async function InspectionPage({ params }: PageProps<"/admin/kho/[deviceId]/kiem-dinh">) {
  await requirePermission("device.inspect");
  const { deviceId } = await params;
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: {
      status: true,
      condition: true,
      imei: true,
      serial: true,
      variant: { select: { storage: true, ram: true, color: true, product: { select: { name: true, category: true } } } },
    },
  });
  if (!device) notFound();
  if (device.status !== "INSPECTING") redirect(`/admin/kho/${deviceId}`);

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Link href={`/admin/kho/${deviceId}`} className="text-sm text-muted-foreground">
        ← Chi tiết máy
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Kiểm định</h1>
        <p className="text-sm text-muted-foreground">
          {device.variant.product.name} · {variantLabel(device.variant)} · {device.imei ?? device.serial}
        </p>
      </div>
      <InspectionForm deviceId={deviceId} category={device.variant.product.category} condition={device.condition} />
    </div>
  );
}
