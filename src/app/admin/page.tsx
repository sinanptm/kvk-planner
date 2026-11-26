import type { Metadata } from "next";
import { Suspense } from "react";
import { KvkAdmin } from "@/components/kvk/admin";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function AdminPage() {
  // Admin is English only, so it stays left to right even in Arabic. data-wide gives it the full screen width.
  return (
    <div dir="ltr" data-wide className="contents">
      <Suspense>
        <KvkAdmin />
      </Suspense>
    </div>
  );
}
