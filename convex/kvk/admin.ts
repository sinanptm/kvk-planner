import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { dayValidator } from "../schema";
import {
  cleanEntry,
  entryFields,
  isAdmin,
  isDateString,
  listAllTurns,
  listPlayers,
  listTurns,
  readSettings,
  requireAdmin,
  settingsRow,
  withTc,
  turnAt,
} from "../lib/data";
import { assignDay, isValidSlot } from "../lib/kvk";

// Admin functions take the password on every call; it is checked against the
// ADMIN_PASSWORD environment variable set in the Convex dashboard.

export const verify = query({
  args: { password: v.string() },
  handler: async (_ctx, { password }) => {
    if (!process.env.ADMIN_PASSWORD) throw new ConvexError("ADMIN_PASSWORD is not set in the Convex dashboard.");
    return isAdmin(password);
  },
});

// Everything the admin page needs. Returns null for a wrong password so the page can log out.
export const dashboard = query({
  args: { password: v.string() },
  handler: async (ctx, { password }) => {
    if (!isAdmin(password)) return null;
    const [settings, players, turns] = await Promise.all([readSettings(ctx), listPlayers(ctx), listAllTurns(ctx)]);
    return {
      settings,
      players: players.map(({ _id, ...p }) => withTc(p)),
      turns: turns.map(({ day, slot, gameId, locked }) => ({ day, slot, gameId, locked })),
    };
  },
});

export const updateSettings = mutation({
  args: {
    password: v.string(),
    eventName: v.optional(v.string()),
    schedulePublished: v.optional(v.boolean()),
    startDate: v.optional(v.string()),
  },
  handler: async (ctx, { password, eventName, schedulePublished, startDate }) => {
    requireAdmin(password);
    const row = await settingsRow(ctx);
    const name = eventName?.trim();
    if (name !== undefined && (!name || name.length > 60)) throw new ConvexError("Event name must be 1–60 characters.");
    if (startDate !== undefined && !isDateString(startDate)) throw new ConvexError("Pick a valid date.");
    await ctx.db.patch("settings", row._id, {
      ...(schedulePublished !== undefined && { schedulePublished }),
      ...(startDate !== undefined && { startDate }),
      ...(name !== undefined && { eventName: name }),
    });
  },
});

export const autoAssign = mutation({
  args: { password: v.string(), day: dayValidator },
  handler: async (ctx, { password, day }) => {
    requireAdmin(password);
    const [players, current] = await Promise.all([listPlayers(ctx), listTurns(ctx, day)]);
    const { turns, waitlist } = assignDay(players, day, current.filter((t) => t.locked));

    for (const t of current) if (!t.locked) await ctx.db.delete("assignments", t._id);
    for (const t of turns) if (!t.locked) await ctx.db.insert("assignments", { day, ...t });

    return { filled: turns.length, waitlisted: waitlist.length };
  },
});

// Put a player on a turn by hand (always locked), or empty the turn with gameId null.
// A player has at most one turn per day, so any other turn they had that day is removed.
export const setTurn = mutation({
  args: { password: v.string(), day: dayValidator, slot: v.number(), gameId: v.union(v.string(), v.null()) },
  handler: async (ctx, { password, day, slot, gameId }) => {
    requireAdmin(password);
    if (!isValidSlot(slot)) throw new ConvexError("Invalid turn.");

    const existing = await turnAt(ctx, day, slot);
    if (existing) await ctx.db.delete("assignments", existing._id);
    if (gameId === null) return;

    const player = await ctx.db
      .query("players")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .unique();
    if (!player) throw new ConvexError("Player not found.");

    const theirs = await ctx.db
      .query("assignments")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .take(100);
    for (const t of theirs) if (t.day === day) await ctx.db.delete("assignments", t._id);

    await ctx.db.insert("assignments", { day, slot, gameId, locked: true });
  },
});

export const setLocked = mutation({
  args: { password: v.string(), day: dayValidator, slot: v.number(), locked: v.boolean() },
  handler: async (ctx, { password, day, slot, locked }) => {
    requireAdmin(password);
    const turn = await turnAt(ctx, day, slot);
    if (turn) await ctx.db.patch("assignments", turn._id, { locked });
  },
});

export const clearDay = mutation({
  args: { password: v.string(), day: dayValidator },
  handler: async (ctx, { password, day }) => {
    requireAdmin(password);
    for (const t of await listTurns(ctx, day)) await ctx.db.delete("assignments", t._id);
  },
});

// Mark whether a player has been told their turns.
export const setInformed = mutation({
  args: { password: v.string(), gameId: v.string(), informed: v.boolean() },
  handler: async (ctx, { password, gameId, informed }) => {
    requireAdmin(password);
    const player = await ctx.db
      .query("players")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .unique();
    if (!player) throw new ConvexError("Player not found.");
    await ctx.db.patch("players", player._id, { informed });
    return null;
  },
});

// Players cannot edit their own entry after signing up; this is the only way to change one.
// Turns the player already has are kept.
export const updatePlayer = mutation({
  args: { password: v.string(), gameId: v.string(), ...entryFields },
  handler: async (ctx, { password, gameId, ...args }) => {
    requireAdmin(password);
    const player = await ctx.db
      .query("players")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .unique();
    if (!player) throw new ConvexError("Player not found.");
    await ctx.db.patch("players", player._id, cleanEntry(args));
    return null;
  },
});

export const deletePlayer = mutation({
  args: { password: v.string(), gameId: v.string() },
  handler: async (ctx, { password, gameId }) => {
    requireAdmin(password);
    const player = await ctx.db
      .query("players")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .unique();
    if (player) await ctx.db.delete("players", player._id);
    const turns = await ctx.db
      .query("assignments")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .take(100);
    for (const t of turns) await ctx.db.delete("assignments", t._id);
  },
});
