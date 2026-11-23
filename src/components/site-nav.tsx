"use client";

import { CalendarDays, ClipboardPen, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "nav.signup", icon: ClipboardPen },
  { href: "/schedule", label: "nav.schedule", icon: CalendarDays },
  { href: "/admin", label: "nav.admin", icon: ShieldCheck },
] as const;

// Links to every page of the planner.
export function SiteNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  return (
    <nav className="flex gap-0.5 rounded-xl bg-muted p-1 min-[360px]:gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[13px] whitespace-nowrap font-medium text-muted-foreground transition-colors hover:text-foreground min-[360px]:px-2.5 sm:px-3 sm:text-sm",
              active && "bg-background text-foreground shadow-sm",
            )}
          >
            <Icon className="hidden size-4 sm:block" />
            {t(label)}
          </Link>
        );
      })}
    </nav>
  );
}
