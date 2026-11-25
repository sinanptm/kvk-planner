"use client";

import { Check, Users } from "lucide-react";
import { MAX_ALLIANCES } from "@/lib/kvk";
import { cn } from "@/lib/utils";

export type AllianceOption = { tag: string; name: string; members: number; power?: number };

// 7403609954 -> "7.4B", 698000000 -> "698M"
const compact = (n: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: n >= 1e9 ? 2 : 1 }).format(n);

// Tap the alliances that take part, from the kingdom's top alliances in the game.
// Tags are case-sensitive ("BTF" and "btf" are different alliances), so names are shown too.
export function AlliancePicker({
  options,
  picked,
  onChange,
}: {
  options: AllianceOption[];
  picked: string[];
  onChange: (tags: string[]) => void;
}) {
  // Picked tags that aren't in the list (picked before the list existed) stay visible so they can be removed.
  const extra: AllianceOption[] = picked.filter((t) => !options.some((o) => o.tag === t)).map((tag) => ({ tag, name: "", members: 0 }));
  const toggle = (tag: string) =>
    onChange(picked.includes(tag) ? picked.filter((t) => t !== tag) : picked.length < MAX_ALLIANCES ? [...picked, tag] : picked);

  return (
    <div className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2">
      {[...extra, ...options].map((o, i) => {
        const on = picked.includes(o.tag);
        return (
          <button
            key={o.tag}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.tag)}
            className={cn(
              "flex h-12 items-center gap-2.5 rounded-lg border px-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              on ? "border-primary/60 bg-primary/10" : "hover:bg-muted/50",
            )}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-md border",
                on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
              )}
            >
              {on && <Check className="size-3.5" />}
            </span>
            <span className="w-11 shrink-0 font-mono text-sm font-semibold">{o.tag}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{o.name}</span>
            {o.members > 0 && (
              <span className="flex shrink-0 flex-col items-end leading-tight">
                {o.power !== undefined && (
                  <span className="font-mono text-sm font-semibold" title="Alliance power">
                    {compact(o.power)}
                  </span>
                )}
                <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                  #{i - extra.length + 1} ·
                  <Users className="size-3" aria-label="members" />
                  {o.members}
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
