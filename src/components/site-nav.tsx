"use client";

import { useConvexAuth } from "convex/react";
import { CalendarDays, ClipboardPen, Gift, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; icon: typeof Gift };

// Inside a kingdom (/2323/...): that kingdom's pages. Elsewhere: support and the leader's account.
export function SiteNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const kingdom = /^\/(\d{1,5})(\/|$)/.exec(pathname)?.[1];

  const links: NavLink[] = kingdom
    ? [
        { href: `/${kingdom}`, label: t("nav.signup"), icon: ClipboardPen },
        { href: `/${kingdom}/schedule`, label: t("nav.schedule"), icon: CalendarDays },
        { href: `/${kingdom}/admin`, label: t("nav.admin"), icon: ShieldCheck },
      ]
    : [
        { href: "/support", label: "Support", icon: Gift },
        isAuthenticated || isLoading
          ? { href: "/account", label: "My kingdoms", icon: UserRound }
          : { href: "/login", label: "Log in", icon: UserRound },
      ];

  return (
    <nav className="flex gap-0.5 rounded-xl bg-muted p-1 min-[360px]:gap-1">
      {links.map(({ href, label, icon: Icon }) => {
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
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
