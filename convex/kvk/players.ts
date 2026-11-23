import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { cleanEntry, entryFields, readSettings, withTc } from "../lib/data";

// Game ID is the only "login". Not secure on purpose: anyone who knows an ID can see that entry.
// Players sign up once; after that only an admin can change the entry (admin.updatePlayer).
const cleanGameId = (raw: string) => {
  const id = raw.trim();
  if (!id || id.length > 32) throw new ConvexError("Enter a valid game ID.");
  return id;
};

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
  args: { gameId: v.string(), ...entryFields },
  handler: async (ctx, { gameId: rawGameId, ...args }) => {
    const gameId = cleanGameId(rawGameId);
    const entry = cleanEntry(args);
    if (entry.d1Slots.length === 0 || entry.d4Slots.length === 0)
      throw new ConvexError("Pick at least one time for Day 1 and for Day 4.");

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
