import type { Metadata } from "next";
import { PublicSchedule } from "@/components/kvk/public-schedule";

export const metadata: Metadata = { title: "Schedule" };

export default function SchedulePage() {
  return <PublicSchedule />;
}
