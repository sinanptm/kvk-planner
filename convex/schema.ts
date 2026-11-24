import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const dayValidator = v.union(v.literal("d1"), v.literal("d4"));

// Every kingdom's data is kept apart by its kingdom number (`kingdom`).
// Speedups are stored in minutes, slots are 0–47 (30-minute turns from 00:00 UTC).
export default defineSchema({
  // Accounts of kingdom leaders. Login details live in the Convex Auth components.
  users: defineTable({}),

  // A kingdom that uses the tool, run by the account that set it up.
  kingdoms: defineTable({
    number: v.number(),
    ownerId: v.id("users"),
    // The leader's own game ID, checked to be in this kingdom when it was set up.
    ownerGameId: v.string(),
    // Alliance tags (upper case) whose members may sign up.
    alliances: v.array(v.string()),
    schedulePublished: v.boolean(),
    // Day 1 of KvK prep as "YYYY-MM-DD" (UTC). Day 4 is three days later.
    startDate: v.optional(v.string()),
  })
    .index("by_number", ["number"])
    .index("by_ownerId", ["ownerId"]),

  players: defineTable({
    kingdom: v.number(),
    gameId: v.string(),
    name: v.string(),
    alliance: v.string(),
    d1Construction: v.number(),
    d1Research: v.number(),
    d1General: v.number(),
    d4Training: v.number(),
    d4General: v.number(),
    // Town Center level as the game reports it (31-35 = TG1, 36-40 = TG2, ...). Truegold is the amount held.
    tcLevel: v.number(),
    truegold: v.number(),
    d1Slots: v.array(v.number()),
    d4Slots: v.array(v.number()),
    // Set by an admin once the player has been told their turns.
    informed: v.optional(v.boolean()),
  }).index("by_kingdom_and_gameId", ["kingdom", "gameId"]),

  assignments: defineTable({
    kingdom: v.number(),
    day: dayValidator,
    slot: v.number(),
    gameId: v.string(),
    locked: v.boolean(),
  })
    .index("by_kingdom_and_day_and_slot", ["kingdom", "day", "slot"])
    .index("by_kingdom_and_gameId", ["kingdom", "gameId"]),

  // What the game (through the MightPulse API) says about a game ID. Shared by all kingdoms,
  // kept for an hour so repeat checks don't use the API.
  playerLookups: defineTable({
    gameId: v.string(),
    fetchedAt: v.number(),
    found: v.boolean(),
    name: v.optional(v.string()),
    alliance: v.optional(v.string()),
    tcLevel: v.optional(v.number()),
    kid: v.optional(v.number()),
  }).index("by_gameId", ["gameId"]),

  // Latest member list of an alliance in a kingdom, for the admin "Missing" tab.
  rosters: defineTable({
    kingdom: v.number(),
    alliance: v.string(),
    fetchedAt: v.number(),
    members: v.array(v.object({ gameId: v.string(), name: v.string(), tcLevel: v.number(), rank: v.string() })),
  }).index("by_kingdom_and_alliance", ["kingdom", "alliance"]),
});
