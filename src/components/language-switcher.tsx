"use client";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useEffect } from "react";
import { LANGUAGES, RTL_LANGS, useLanguage, type Lang } from "@/lib/i18n";

function Flag({ code }: { code: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static SVG, no optimisation needed
    <img src={`/flags/${code}.svg`} alt="" width={20} height={15} className="h-[15px] w-5 shrink-0 rounded-[3px] object-cover ring-1 ring-white/15" />
  );
}

// Language menu in the header, showing the current language's flag. The choice is remembered in this browser.
export function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  // Tell the browser the page language, and flip the layout for right-to-left languages like Arabic.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGS.includes(lang) ? "rtl" : "ltr";
  }, [lang]);

  return (
    <Select value={lang} onValueChange={(value) => value && setLang(value as Lang)}>
      <SelectTrigger aria-label={t("lang.label")} className="h-9! gap-1.5 px-2 [&>svg]:hidden">
        <span className="flex items-center gap-1.5">
          <Flag code={current.flag} />
          <span className="font-mono text-xs font-semibold uppercase">{lang}</span>
        </span>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="end" className="min-w-48!">
        {LANGUAGES.map(({ code, name, flag }) => (
          <SelectItem key={code} value={code}>
            <span className="flex items-center gap-2.5">
              <Flag code={flag} />
              {name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
