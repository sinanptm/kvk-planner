import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { cleanEntry, cleanGameId, entryValidator, getKingdom, getPlayer, playerTurns } from "../lib/data";
import { LOOKUP_VALID_MS } from "./lookup";

// Game ID is the only "login" for players. Not secure on purpose: anyone who knows an ID can see that entry.
// Players sign up once; after that only the kingdom's admin can change the entry (admin.updatePlayer).
// Name, alliance and Town Center level come from the game (see lookup.ts), not from the player.

export const get = query({
  args: { kingdom: v.number(), gameId: v.string() },
  handler: async (ctx, { kingdom, gameId }) => {
    const player = await getPlayer(ctx, kingdom, gameId.trim());
    if (!player) return null;
    const { _id, kingdom: _, ...entry } = player;
    return entry;
  },
});

export const save = mutation({
  args: { kingdom: v.number(), gameId: v.string(), ...entryValidator.omit("name", "alliance", "tcLevel").fields },
  handler: async (ctx, { kingdom: number, gameId: rawGameId, ...args }) => {
    const kingdom = await getKingdom(ctx, number);
    if (!kingdom) throw new ConvexError("This kingdom isn't set up.");
    const gameId = cleanGameId(rawGameId);
    const lookup = await ctx.db
      .query("playerLookups")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .unique();
    if (
      !lookup?.found ||
      lookup.kid !== number ||
      !kingdom.alliances.includes(lookup.alliance ?? "") ||
      Date.now() - lookup.fetchedAt > LOOKUP_VALID_MS
    )
      throw new ConvexError("Check your game ID again before signing up.");
    const entry = cleanEntry(
      { ...args, name: lookup.name ?? "", alliance: lookup.alliance ?? "", tcLevel: lookup.tcLevel ?? 0 },
      kingdom.alliances,
    );
    if (entry.d1Slots.length === 0 || entry.d4Slots.length === 0)
      throw new ConvexError("Pick at least one time for Day 1 and for Day 4.");
    if (await getPlayer(ctx, number, gameId))
      throw new ConvexError("This game ID is already signed up. Entries can't be edited — ask your King or R4.");

    await ctx.db.insert("players", { kingdom: number, gameId, ...entry });
    return null;
  },
});

// The player's own turns, only once the schedule is published.
export const myTurns = query({
  args: { kingdom: v.number(), gameId: v.string() },
  handler: async (ctx, { kingdom, gameId }) => {
    const k = await getKingdom(ctx, kingdom);
    if (!k?.schedulePublished) return null;
    const turns = await playerTurns(ctx, kingdom, gameId.trim());
    return turns.map(({ day, slot }) => ({ day, slot })).sort((a, b) => a.day.localeCompare(b.day) || a.slot - b.slot);
  },
});
