import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/dal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập quản trị", robots: { index: false } };

// Form render tĩnh (không nằm trong Suspense) để chữ đang gõ không bị thay mất khi phần động stream về.
export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-background p-4">
      <Logo size={44} textClassName="text-3xl" />
      <Card className="w-full max-w-sm rounded-3xl">
        <CardHeader>
          <CardTitle className="text-xl">Đăng nhập quản trị</CardTitle>
          <CardDescription>Dành cho chủ cửa hàng và nhân viên</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
      <Suspense fallback={null}>
        <RedirectIfLoggedIn />
      </Suspense>
    </main>
  );
}

async function RedirectIfLoggedIn() {
  if (await getCurrentUser()) redirect("/admin");
  return null;
}
