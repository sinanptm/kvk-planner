import { Suspense, type ReactNode } from "react";
import { KingdomShell } from "@/components/kvk/kingdom-shell";

// Every page under /<kingdom number> works on that kingdom.
export default function KingdomLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <KingdomShell>{children}</KingdomShell>
    </Suspense>
  );
}
