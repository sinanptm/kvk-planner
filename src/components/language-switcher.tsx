"use client";

import { Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { LANGUAGES, useLanguage, type Lang } from "@/lib/i18n";

// Language menu in the header. The choice is remembered in this browser.
export function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();
  return (
    <Select value={lang} onValueChange={(value) => value && setLang(value as Lang)}>
      <SelectTrigger aria-label={t("lang.label")} className="h-9! gap-1.5 px-2 [&>svg]:hidden">
        <span className="flex items-center gap-1.5">
          <Languages className="size-4" />
          <span className="font-mono text-xs font-semibold uppercase">{lang}</span>
        </span>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="end" className="min-w-44!">
        {LANGUAGES.map(({ code, name }) => (
          <SelectItem key={code} value={code}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
