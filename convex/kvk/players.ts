import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { cleanEntry, entryValidator, readSettings, withTc } from "../lib/data";
import { MIN_SLOTS } from "../lib/kvk";
import { cleanLookupId } from "./lookup";

// Game ID is the only "login". Not secure on purpose: anyone who knows an ID can see that entry.
// Players sign up once; after that only an admin can change the entry (admin.updatePlayer).
// Name, alliance and Town Center level come from the game (see lookup.ts), not from the player.
const LOOKUP_VALID_MS = 2 * 60 * 60 * 1000;

export const get = query({
  args: { gameId: v.string() },
  handler: async (ctx, { gameId }) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId.trim()))
      .unique();
    if (!player) return null;
    const { _id, ...entry } = player;
    return withTc(entry);
  },
});

export const save = mutation({
  args: { gameId: v.string(), ...entryValidator.omit("name", "alliance", "tcLevel").fields },
  handler: async (ctx, { gameId: rawGameId, ...args }) => {
    const gameId = cleanLookupId(rawGameId);
    const lookup = await ctx.db
      .query("playerLookups")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .unique();
    // A saved "wrong_alliance" may predate a newly added alliance; cleanEntry checks the alliance below.
    const allowed = lookup?.status === "ok" || lookup?.status === "wrong_alliance";
    if (!lookup || !allowed || Date.now() - lookup.fetchedAt > LOOKUP_VALID_MS)
      throw new ConvexError("Check your game ID again before signing up.");
    const entry = cleanEntry({
      ...args,
      name: lookup.name ?? "",
      alliance: lookup.alliance ?? "",
      tcLevel: lookup.tcLevel ?? 0,
    });
    if ([entry.d1Slots, entry.d2Slots, entry.d4Slots].some((slots) => slots.length < MIN_SLOTS))
      throw new ConvexError(`Pick at least ${MIN_SLOTS} times for each day.`);

    const existing = await ctx.db
      .query("players")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .unique();
    if (existing)
      throw new ConvexError("This game ID is already signed up. Entries can't be edited — ask your King or R4.");

    await ctx.db.insert("players", { gameId, ...entry });
    return null;
  },
});

// The player's own turns, only once the schedule is published.
export const myTurns = query({
  args: { gameId: v.string() },
  handler: async (ctx, { gameId }) => {
    const settings = await readSettings(ctx);
    if (!settings.schedulePublished) return null;
    const turns = await ctx.db
      .query("assignments")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId.trim()))
      .take(100);
    return turns.map(({ day, slot }) => ({ day, slot })).sort((a, b) => a.day.localeCompare(b.day) || a.slot - b.slot);
  },
});
