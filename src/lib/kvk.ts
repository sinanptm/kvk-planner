import { useSyncExternalStore } from "react";
import { SLOT_COUNT, type DayKey } from "@convex/lib/kvk";

export { ALLIANCES, DAY_KEYS, SLOT_COUNT, assignDay, dayScore, rankPlayers, type DayKey } from "@convex/lib/kvk";

// dayScore for objects that only carry the speedup fields (forms, summaries).
export const dayScoreOf = (
  e: { d1Construction: number; d1Research: number; d1General: number; d4Training: number; d4General: number },
  day: DayKey,
) => (day === "d1" ? e.d1Construction + e.d1Research + e.d1General : e.d4Training + e.d4General);

export const SLOTS = Array.from({ length: SLOT_COUNT }, (_, i) => i);

export const DAYS: Record<DayKey, { label: string; title: string; position: string; scoreHint: string }> = {
  d1: {
    label: "Day 1",
    title: "Construction & Research",
    position: "Chief Minister",
    scoreHint: "Construction + research + general speedups",
  },
  d4: {
    label: "Day 4",
    title: "Training",
    position: "Noble Advisor",
    scoreHint: "Training + general speedups",
  },
};

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;

export const slotUtc = (slot: number) => hhmm(slot * 30);
export const slotRangeUtc = (slot: number) => `${hhmm(slot * 30)}–${hhmm(slot * 30 + 30)}`;

const timeFormat = () => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// Local start time of a turn, using today's date for the UTC offset.
// dayShift is -1/+1 when the turn falls on the previous/next day locally.
export function slotLocal(slot: number, today: Date) {
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, slot * 30),
  );
  const local = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const utc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  return { time: timeFormat().format(start), dayShift: Math.sign(local - utc) };
}

export const formatSlotLocal = (slot: number, today: Date) => {
  const { time, dayShift } = slotLocal(slot, today);
  return dayShift === 0 ? time : `${time} (${dayShift > 0 ? "+1" : "−1"} day)`;
};

const noopSubscribe = () => () => {};
let clientNow: Date | null = null;

// Current date on the client, null during server render and hydration.
// Local times depend on the viewer's time zone, so they only render in the browser.
export function useToday(): Date | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => (clientNow ??= new Date()),
    () => null,
  );
}

export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function formatDuration(minutes: number) {
  if (minutes <= 0) return "0m";
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(" ");
}

// One colour per alliance: the small tag, a filled turn tile, and a plain dot.
export const ALLIANCE_STYLES: Record<string, { tag: string; tile: string; dot: string }> = {
  VIK: {
    tag: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    tile: "border-sky-500/50 bg-sky-500/10 hover:bg-sky-500/20 dark:bg-sky-500/10 dark:hover:bg-sky-500/20",
    dot: "bg-sky-500",
  },
  TEA: {
    tag: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    tile: "border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20",
    dot: "bg-emerald-500",
  },
  BTF: {
    tag: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    tile: "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-500/10 dark:hover:bg-amber-500/20",
    dot: "bg-amber-500",
  },
  FFF: {
    tag: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    tile: "border-violet-500/50 bg-violet-500/10 hover:bg-violet-500/20 dark:bg-violet-500/10 dark:hover:bg-violet-500/20",
    dot: "bg-violet-500",
  },
};

export const playerLabel = (p: { name: string; alliance: string }) =>
  p.alliance ? `[${p.alliance}] ${p.name}` : p.name;

// Lowercase, accents and punctuation removed, so "Ödin_99" and "odin 99" compare equal.
const normalize = (text: string) =>
  text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

const isSubsequence = (needle: string, haystack: string) => {
  let i = 0;
  for (const ch of haystack) if (ch === needle[i]) i++;
  return i === needle.length;
};

// Forgiving player search over name, alliance tag and game ID. Every word of the query must match.
// Exact pieces ("king", "1001") rank first; words with skipped or missing letters ("tstkng") still match the name.
export function searchPlayers<P extends { name: string; alliance: string; gameId: string }>(players: P[], query: string): P[] {
  const words = query.split(/\s+/).map(normalize).filter(Boolean);
  if (words.length === 0) return players;
  const exact: P[] = [];
  const loose: P[] = [];
  for (const p of players) {
    const name = normalize(p.name);
    const all = name + " " + normalize(p.alliance) + " " + normalize(p.gameId);
    if (words.every((w) => all.includes(w))) exact.push(p);
    else if (words.every((w) => all.includes(w) || (w.length >= 3 && isSubsequence(w, name)))) loose.push(p);
  }
  return [...exact, ...loose];
}
