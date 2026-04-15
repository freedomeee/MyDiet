import type { Metadata } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";
import { cn } from "@/lib/utils";

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body"
});

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "用户档案 | Diet Profile",
  description: "根据用户身体信息与目标实时生成每日热量预算和饮食结构的健康管理档案页。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={cn(bodyFont.variable, displayFont.variable, "font-sans antialiased")}>{children}</body>
    </html>
  );
}
