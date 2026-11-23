"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useLanguage } from "@/lib/i18n";
import { dayDate, type DayKey } from "@/lib/kvk";

// Formats a prep day's date in the player's language, from the Day 1 date the admin set.
// Returns null for a day while no date is set, so callers can leave the date out.
export function useDayDate() {
  const settings = useQuery(api.kvk.schedule.settings);
  const { lang } = useLanguage();
  return (day: DayKey, long = false) => dayDate(settings?.startDate, day, lang, long);
}
