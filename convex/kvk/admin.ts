import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { dayValidator } from "../schema";
import {
  cleanEntry,
  cleanGameId,
  entryFields,
  getPlayer,
  listAllTurns,
  listPlayers,
  listTurns,
  ownedKingdom,
  playerTurns,
  publicKingdom,
  requireOwner,
  turnAt,
} from "../lib/data";
import { assignDay, isValidSlot } from "../lib/kvk";

// Every function here works on one kingdom and needs the account that runs it.

// Everything the admin page needs. Null unless the signed-in account runs this kingdom.
export const dashboard = query({
  args: { kingdom: v.number() },
  handler: async (ctx, { kingdom }) => {
    const k = await ownedKingdom(ctx, kingdom);
    if (!k) return null;
    const [players, turns] = await Promise.all([listPlayers(ctx, kingdom), listAllTurns(ctx, kingdom)]);
    return {
      kingdom: publicKingdom(k),
      players: players.map(({ _id, kingdom: _, ...p }) => p),
      turns: turns.map(({ day, slot, gameId, locked }) => ({ day, slot, gameId, locked })),
    };
  },
});

export const autoAssign = mutation({
  args: { kingdom: v.number(), day: dayValidator },
  handler: async (ctx, { kingdom, day }) => {
    await requireOwner(ctx, kingdom);
    const [players, current] = await Promise.all([listPlayers(ctx, kingdom), listTurns(ctx, kingdom, day)]);
    const { turns, waitlist } = assignDay(players, day, current.filter((t) => t.locked));

    for (const t of current) if (!t.locked) await ctx.db.delete("assignments", t._id);
    for (const t of turns) if (!t.locked) await ctx.db.insert("assignments", { kingdom, day, ...t });

    return { filled: turns.length, waitlisted: waitlist.length };
  },
});

// Put a player on a turn by hand (always locked), or empty the turn with gameId null.
// A player has at most one turn per day, so any other turn they had that day is removed.
export const setTurn = mutation({
  args: { kingdom: v.number(), day: dayValidator, slot: v.number(), gameId: v.union(v.string(), v.null()) },
  handler: async (ctx, { kingdom, day, slot, gameId }) => {
    await requireOwner(ctx, kingdom);
    if (!isValidSlot(slot)) throw new ConvexError("Invalid turn.");

    const existing = await turnAt(ctx, kingdom, day, slot);
    if (existing) await ctx.db.delete("assignments", existing._id);
    if (gameId === null) return;

    if (!(await getPlayer(ctx, kingdom, gameId))) throw new ConvexError("Player not found.");
    for (const t of await playerTurns(ctx, kingdom, gameId)) if (t.day === day) await ctx.db.delete("assignments", t._id);

    await ctx.db.insert("assignments", { kingdom, day, slot, gameId, locked: true });
  },
});

export const setLocked = mutation({
  args: { kingdom: v.number(), day: dayValidator, slot: v.number(), locked: v.boolean() },
  handler: async (ctx, { kingdom, day, slot, locked }) => {
    await requireOwner(ctx, kingdom);
    const turn = await turnAt(ctx, kingdom, day, slot);
    if (turn) await ctx.db.patch("assignments", turn._id, { locked });
  },
});

export const clearDay = mutation({
  args: { kingdom: v.number(), day: dayValidator },
  handler: async (ctx, { kingdom, day }) => {
    await requireOwner(ctx, kingdom);
    for (const t of await listTurns(ctx, kingdom, day)) await ctx.db.delete("assignments", t._id);
  },
});

// Mark whether a player has been told their turns.
export const setInformed = mutation({
  args: { kingdom: v.number(), gameId: v.string(), informed: v.boolean() },
  handler: async (ctx, { kingdom, gameId, informed }) => {
    await requireOwner(ctx, kingdom);
    const player = await getPlayer(ctx, kingdom, gameId);
    if (!player) throw new ConvexError("Player not found.");
    await ctx.db.patch("players", player._id, { informed });
    return null;
  },
});

// Adds a player on their behalf (for players who can't or won't use the sign-up page).
export const addPlayer = mutation({
  args: { kingdom: v.number(), gameId: v.string(), ...entryFields },
  handler: async (ctx, { kingdom, gameId: rawId, ...args }) => {
    const k = await requireOwner(ctx, kingdom);
    const gameId = cleanGameId(rawId);
    const existing = await getPlayer(ctx, kingdom, gameId);
    if (existing) throw new ConvexError(`${existing.name} (ID ${gameId}) is already signed up.`);
    await ctx.db.insert("players", { kingdom, gameId, ...cleanEntry(args, k.alliances) });
    return null;
  },
});

// Players cannot edit their own entry after signing up; this is the only way to change one.
// Turns the player already has are kept.
export const updatePlayer = mutation({
  args: { kingdom: v.number(), gameId: v.string(), ...entryFields },
  handler: async (ctx, { kingdom, gameId, ...args }) => {
    const k = await requireOwner(ctx, kingdom);
    const player = await getPlayer(ctx, kingdom, gameId);
    if (!player) throw new ConvexError("Player not found.");
    await ctx.db.patch("players", player._id, cleanEntry(args, k.alliances));
    return null;
  },
});

export const deletePlayer = mutation({
  args: { kingdom: v.number(), gameId: v.string() },
  handler: async (ctx, { kingdom, gameId }) => {
    await requireOwner(ctx, kingdom);
    const player = await getPlayer(ctx, kingdom, gameId);
    if (player) await ctx.db.delete("players", player._id);
    for (const t of await playerTurns(ctx, kingdom, gameId)) await ctx.db.delete("assignments", t._id);
  },
});
