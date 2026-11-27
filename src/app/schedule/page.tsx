import type { Metadata } from "next";
import { PublicSchedule } from "@/components/kvk/public-schedule";

export const metadata: Metadata = { title: "Schedule" };

export default function SchedulePage() {
  // Wide (data-wide) so the three-day calendar has room on laptops.
  return (
    <div data-wide className="contents">
      <PublicSchedule />
    </div>
  );
}
