"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { createContext, useContext, type ReactNode } from "react";
import { allianceStyle } from "@/lib/kvk";

export type Kingdom = {
  number: number;
  alliances: string[];
  schedulePublished: boolean;
  status: "pending" | "approved" | "rejected";
  startDate: string | null;
};

const KingdomContext = createContext<Kingdom | null>(null);

// Loads a kingdom by number. Renders `missing` when nobody has set it up yet.
export function KingdomProvider({
  number,
  missing,
  children,
}: {
  number: number;
  missing: ReactNode;
  children: ReactNode;
}) {
  const kingdom = useQuery(api.kvk.kingdoms.get, { number });
  if (kingdom === undefined) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (kingdom === null) return missing;
  return <KingdomContext value={kingdom}>{children}</KingdomContext>;
}

// The kingdom of the page. Only for components under a KingdomProvider.
export function useKingdom(): Kingdom {
  const kingdom = useContext(KingdomContext);
  if (!kingdom) throw new Error("useKingdom needs a KingdomProvider.");
  return kingdom;
}

export const useOptionalKingdom = () => useContext(KingdomContext);

// The colour of an alliance tag in the current kingdom (grey outside one).
export function useAllianceStyle() {
  const alliances = useContext(KingdomContext)?.alliances ?? [];
  return (tag: string) => allianceStyle(alliances, tag);
}
