import type { Metadata } from "next";
import { SuperAdmin } from "@/components/site/super-admin";

export const metadata: Metadata = { title: "Super admin", robots: { index: false } };

export default function SuperAdminPage() {
  return <SuperAdmin />;
}
