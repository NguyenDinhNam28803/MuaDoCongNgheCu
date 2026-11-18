import type { Metadata } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// TECNOVA: Be Vietnam Pro (thiết kế cho tiếng Việt) + JetBrains Mono cho số liệu kiểm định.
const sans = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-tecnova",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: { default: "TECNOVA", template: "%s · TECNOVA" },
  description: "Điện thoại, laptop, phụ kiện mới và đã qua sử dụng — kiểm định minh bạch từng máy.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
