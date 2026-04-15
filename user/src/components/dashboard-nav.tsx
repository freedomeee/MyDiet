"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartPulse, NotebookTabs, UtensilsCrossed } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/",
    label: "用户档案",
    icon: NotebookTabs
  },
  {
    href: "/identify",
    label: "饮食记录",
    icon: UtensilsCrossed
  },
  {
    href: "/insights",
    label: "个性化分析",
    icon: HeartPulse
  }
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-3 rounded-full border border-white/60 bg-white/70 p-2 shadow-soft backdrop-blur">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
              isActive ? "bg-[#2f211c] text-white shadow-soft" : "text-foreground hover:bg-white/75"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
