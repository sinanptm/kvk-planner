import type { Metadata } from "next";
import { KvkAdmin } from "@/components/kvk/admin";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function AdminPage() {
  // Admin pages are English only, so they stay left to right even when the player picked Arabic.
  return (
    <div dir="ltr" className="contents">
      <KvkAdmin />
    </div>
  );
}
