import type { Metadata } from "next";
import { Support } from "@/components/site/support";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage() {
  return <Support />;
}
