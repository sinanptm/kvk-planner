import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v, type Infer } from "convex/values";
import { components } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { MAX_TRUEGOLD, isValidSlot, type DayKey } from "./kvk";

// Upper bounds for reads. A kingdom never has anywhere near this many players.
export const MAX_PLAYERS = 2000;
const MAX_TURNS = 200;

export const getKingdom = (ctx: QueryCtx, number: number) =>
  ctx.db
    .query("kingdoms")
    .withIndex("by_number", (q) => q.eq("number", number))
    .unique();

// An approved kingdom, or null when it doesn't exist or is still waiting for approval (or was rejected).
export async function openKingdom(ctx: QueryCtx, number: number): Promise<Doc<"kingdoms"> | null> {
  const kingdom = await getKingdom(ctx, number);
  return kingdom?.status === "approved" ? kingdom : null;
}

// The kingdom (in any approval state), if the signed-in account runs it; otherwise null.
export async function ownedKingdom(ctx: QueryCtx, number: number): Promise<Doc<"kingdoms"> | null> {
  const [userId, kingdom] = await Promise.all([getAuthUserId(ctx), getKingdom(ctx, number)]);
  return userId !== null && kingdom?.ownerId === userId ? kingdom : null;
}

// The kingdom, if the signed-in account runs it and it has been approved.
export async function requireOwner(ctx: QueryCtx, number: number): Promise<Doc<"kingdoms">> {
  const kingdom = await ownedKingdom(ctx, number);
  if (!kingdom) throw new ConvexError("Log in with the account that runs this kingdom.");
  if (kingdom.status !== "approved") throw new ConvexError("This kingdom is waiting for approval.");
  return kingdom;
}

// The developer's accounts, by login email, from the Convex env var SUPER_ADMIN_EMAILS (comma separated).
const superEmails = () =>
  (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export async function isSuperAdmin(ctx: QueryCtx): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return false;
  const email = await ctx.runQuery(components.authUsername.public.getUsername, { userId });
  return !!email && superEmails().includes(email.toLowerCase());
}

export async function requireSuperAdmin(ctx: QueryCtx) {
  if (!(await isSuperAdmin(ctx))) throw new ConvexError("Only the developer can do this.");
}

// What players and the public may see about a kingdom.
export const publicKingdom = (k: Doc<"kingdoms">) => ({
  number: k.number,
  alliances: k.alliances,
  schedulePublished: k.schedulePublished,
  status: k.status,
  startDate: k.startDate ?? null,
});

export const listPlayers = (ctx: QueryCtx, kingdom: number) =>
  ctx.db
    .query("players")
    .withIndex("by_kingdom_and_gameId", (q) => q.eq("kingdom", kingdom))
    .take(MAX_PLAYERS);

export const getPlayer = (ctx: QueryCtx, kingdom: number, gameId: string) =>
  ctx.db
    .query("players")
    .withIndex("by_kingdom_and_gameId", (q) => q.eq("kingdom", kingdom).eq("gameId", gameId))
    .unique();

export const listAllTurns = (ctx: QueryCtx, kingdom: number) =>
  ctx.db
    .query("assignments")
    .withIndex("by_kingdom_and_day_and_slot", (q) => q.eq("kingdom", kingdom))
    .take(MAX_TURNS * 2);

export const listTurns = (ctx: QueryCtx, kingdom: number, day: DayKey) =>
  ctx.db
    .query("assignments")
    .withIndex("by_kingdom_and_day_and_slot", (q) => q.eq("kingdom", kingdom).eq("day", day))
    .take(MAX_TURNS);

export const turnAt = (ctx: QueryCtx, kingdom: number, day: DayKey, slot: number) =>
  ctx.db
    .query("assignments")
    .withIndex("by_kingdom_and_day_and_slot", (q) => q.eq("kingdom", kingdom).eq("day", day).eq("slot", slot))
    .first();

export const playerTurns = (ctx: QueryCtx, kingdom: number, gameId: string) =>
  ctx.db
    .query("assignments")
    .withIndex("by_kingdom_and_gameId", (q) => q.eq("kingdom", kingdom).eq("gameId", gameId))
    .take(10);

// A real calendar date written as YYYY-MM-DD.
export const isDateString = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

// What a player (or an admin on their behalf) fills in. The game ID is passed separately.
export const entryValidator = v.object({
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

export function cleanEntry(args: Infer<typeof entryValidator>, alliances: string[]) {
  const name = args.name.trim();
  if (!name || name.length > 40) throw new ConvexError("Enter the in-game name (max 40 characters).");
  const alliance = args.alliance.trim();
  if (!alliances.includes(alliance)) throw new ConvexError(`Pick an alliance: ${alliances.join(", ")}.`);
  if (!Number.isInteger(args.tcLevel) || args.tcLevel < 1 || args.tcLevel > 60)
    throw new ConvexError("Pick a Town Center level.");
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

// Game IDs are digits; checked before calling the API so junk input costs nothing.
export const cleanGameId = (raw: string) => {
  const id = raw.trim();
  if (!/^\d{3,15}$/.test(id)) throw new ConvexError("Enter your game ID (numbers only).");
  return id;
};
