import { Crown } from "lucide-react";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { LanguageSwitcher } from "@/components/language-switcher";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-4xl group-has-[[data-wide]]/body:max-w-[1800px] items-center gap-2 px-3 min-[360px]:gap-3 min-[360px]:px-4">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Crown className="size-4.5" />
          </span>
          <span className="hidden sm:inline">2323 Appointments</span>
        </Link>
        <div className="ml-auto flex items-center gap-1 min-[360px]:gap-2">
          <SiteNav />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
