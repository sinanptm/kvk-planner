"use client";

import { useLanguage } from "@/lib/i18n";
import { dayDate, type DayKey } from "@/lib/kvk";
import { useKingdom } from "./kingdom-context";

// Formats a prep day's date in the player's language, from the Day 1 date the kingdom's admin set.
// Returns null for a day while no date is set, so callers can leave the date out.
export function useDayDate() {
  const { startDate } = useKingdom();
  const { lang } = useLanguage();
  return (day: DayKey, long = false) => dayDate(startDate, day, lang, long);
}
