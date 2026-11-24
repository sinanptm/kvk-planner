"use client";

import { api } from "@convex/_generated/api";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const authApi = {
  refreshSession: api.auth.refreshSession,
  signOut: api.auth.signOut,
  isAuthenticated: api.auth.isAuthenticated,
};

// Convex with Convex Auth: kingdom leaders' sessions are kept in this browser's storage.
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex} api={authApi}>
      {children}
    </ConvexAuthProvider>
  );
}
