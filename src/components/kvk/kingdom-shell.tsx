"use client";

import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isKingdomNumber } from "@/lib/kvk";
import { KingdomProvider, useKingdom } from "./kingdom-context";
import { KingdomMissing } from "./kingdom-missing";

// Reads the kingdom number from the URL (/2323/...) and loads that kingdom for the pages below.
export function KingdomShell({ children }: { children: ReactNode }) {
  const { kingdom } = useParams<{ kingdom: string }>();
  const isAdminPage = /\/admin\/?$/.test(usePathname());
  const number = /^\d+$/.test(kingdom) ? Number(kingdom) : NaN;
  if (!isKingdomNumber(number)) return <KingdomMissing number={null} />;
  return (
    <KingdomProvider number={number} missing={<KingdomMissing number={number} />}>
      {isAdminPage ? children : <OpenOnly number={number}>{children}</OpenOnly>}
    </KingdomProvider>
  );
}

// Players only reach a kingdom once the developer has approved it. Its admin page explains the wait.
function OpenOnly({ number, children }: { number: number; children: ReactNode }) {
  const { status } = useKingdom();
  return status === "approved" ? children : <KingdomMissing number={number} waiting />;
}
