import { ConvexError, v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ALLIANCES, MAX_TRUEGOLD, TC_MAX_LEVEL, isValidSlot, type DayKey } from "./kvk";

// Upper bounds for reads. A kingdom never has anywhere near this many players.
export const MAX_PLAYERS = 2000;
const MAX_TURNS = 200;

export const DEFAULT_SETTINGS = {
  eventName: "KvK",
  schedulePublished: false,
};

export type Settings = typeof DEFAULT_SETTINGS;

export async function readSettings(ctx: QueryCtx): Promise<Settings> {
  const row = await ctx.db.query("settings").first();
  if (!row) return DEFAULT_SETTINGS;
  const { eventName, schedulePublished } = row;
  return { eventName, schedulePublished };
}

export async function settingsRow(ctx: MutationCtx): Promise<Doc<"settings">> {
  const row = await ctx.db.query("settings").first();
  if (row) return row;
  const id = await ctx.db.insert("settings", DEFAULT_SETTINGS);
  return (await ctx.db.get("settings", id))!;
}

export function requireAdmin(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new ConvexError("ADMIN_PASSWORD is not set in the Convex dashboard.");
  if (password !== expected) throw new ConvexError("Wrong admin password.");
}

export const isAdmin = (password: string) =>
  !!process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD;

export const listPlayers = (ctx: QueryCtx) => ctx.db.query("players").take(MAX_PLAYERS);

export const listAllTurns = (ctx: QueryCtx) => ctx.db.query("assignments").take(MAX_TURNS * 2);

export const listTurns = (ctx: QueryCtx, day: DayKey) =>
  ctx.db
    .query("assignments")
    .withIndex("by_day_and_slot", (q) => q.eq("day", day))
    .take(MAX_TURNS);

export const turnAt = (ctx: QueryCtx, day: DayKey, slot: number) =>
  ctx.db
    .query("assignments")
    .withIndex("by_day_and_slot", (q) => q.eq("day", day).eq("slot", slot))
    .first();

// What a player (or an admin on their behalf) fills in. The game ID is passed separately.
const entryValidator = v.object({
  name: v.string(),
  alliance: v.string(),
  tcLevel: v.number(),
  truegold: v.number(),
  d1Construction: v.number(),
  d1Research: v.number(),
  d1General: v.number(),
  d4Training: v.number(),
  d4General: v.number(),
  d1Slots: v.array(v.number()),
  d4Slots: v.array(v.number()),
});

export const entryFields = entryValidator.fields;

const cleanMinutes = (n: number) => (Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 0), 10_000_000) : 0);

const cleanSlots = (slots: number[]) => [...new Set(slots.filter(isValidSlot))].sort((a, b) => a - b);

export function cleanEntry(args: Infer<typeof entryValidator>) {
  const name = args.name.trim();
  if (!name || name.length > 40) throw new ConvexError("Enter the in-game name (max 40 characters).");
  const alliance = args.alliance.trim().toUpperCase();
  if (!(ALLIANCES as readonly string[]).includes(alliance))
    throw new ConvexError(`Pick an alliance: ${ALLIANCES.join(", ")}.`);
  if (!Number.isInteger(args.tcLevel) || args.tcLevel < 1 || args.tcLevel > TC_MAX_LEVEL)
    throw new ConvexError("Pick your Town Center level.");
  return {
    name,
    alliance,
    tcLevel: args.tcLevel,
    truegold: Number.isFinite(args.truegold) ? Math.min(Math.max(Math.round(args.truegold), 0), MAX_TRUEGOLD) : 0,
    d1Construction: cleanMinutes(args.d1Construction),
    d1Research: cleanMinutes(args.d1Research),
    d1General: cleanMinutes(args.d1General),
    d4Training: cleanMinutes(args.d4Training),
    d4General: cleanMinutes(args.d4General),
    d1Slots: cleanSlots(args.d1Slots),
    d4Slots: cleanSlots(args.d4Slots),
  };
}

// Players saved before Town Center level and Truegold existed have neither; show them as 0.
export const withTc = <P extends { tcLevel?: number; truegold?: number }>(p: P) => ({
  ...p,
  tcLevel: p.tcLevel ?? 0,
  truegold: p.truegold ?? 0,
});
