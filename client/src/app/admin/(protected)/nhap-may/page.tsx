import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/dal";
import { IntakeForm } from "./intake-form";

export const metadata: Metadata = { title: "Nhập máy" };

export default async function IntakePage() {
  await requirePermission("device.intake");
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Nhập máy</h1>
      <IntakeForm />
    </div>
  );
}
