"use client";

import { cn } from "@/lib/utils";
import { useAllianceStyle } from "./kingdom-context";

// Alliance tag in its alliance colour. Tags outside the kingdom's alliances stay grey.
export function AllianceTag({ alliance, className }: { alliance: string; className?: string }) {
  const styleOf = useAllianceStyle();
  if (!alliance) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-md px-1.5 font-mono text-[11px] font-semibold",
        styleOf(alliance).tag,
        className,
      )}
    >
      {alliance}
    </span>
  );
}

// Coloured alliance tag followed by the player's name; the name truncates, the tag never does.
export function PlayerName({
  player,
  className,
}: {
  player: { name: string; alliance: string };
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 align-middle", className)}>
      <AllianceTag alliance={player.alliance} />
      <span className="truncate">{player.name}</span>
    </span>
  );
}
