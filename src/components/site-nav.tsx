"use client";

import { CalendarDays, ClipboardPen, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Sign up", icon: ClipboardPen },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
];

// Links to every page of the planner.
export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 rounded-xl bg-muted p-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-3",
              active && "bg-background text-foreground shadow-sm",
            )}
          >
            <Icon className="hidden size-4 sm:block" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
