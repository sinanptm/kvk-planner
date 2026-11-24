import type { Metadata } from "next";
import { Account } from "@/components/site/account";

export const metadata: Metadata = { title: "My kingdoms", robots: { index: false } };

export default function AccountPage() {
  return <Account />;
}
