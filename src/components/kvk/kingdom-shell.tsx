"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { isKingdomNumber } from "@/lib/kvk";
import { KingdomProvider } from "./kingdom-context";
import { KingdomMissing } from "./kingdom-missing";

// Reads the kingdom number from the URL (/2323/...) and loads that kingdom for the pages below.
export function KingdomShell({ children }: { children: ReactNode }) {
  const { kingdom } = useParams<{ kingdom: string }>();
  const number = /^\d+$/.test(kingdom) ? Number(kingdom) : NaN;
  if (!isKingdomNumber(number)) return <KingdomMissing number={null} />;
  return (
    <KingdomProvider number={number} missing={<KingdomMissing number={number} />}>
      {children}
    </KingdomProvider>
  );
}
