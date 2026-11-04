import type { Metadata } from "next";
import { KvkAdmin } from "@/components/kvk/admin";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function AdminPage() {
  return <KvkAdmin />;
}
