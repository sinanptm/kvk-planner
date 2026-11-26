import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const dayValidator = v.union(v.literal("d1"), v.literal("d2"), v.literal("d4"));

export default defineSchema({
  // KvK Appointment Planner. Speedups are stored in minutes, slots are 0–47 (30-minute turns from 00:00 UTC).
  players: defineTable({
    gameId: v.string(),
    name: v.string(),
    alliance: v.string(),
    // Day 1 construction, Day 2 research, Day 4 training; each day also has its own general speedups.
    d1Construction: v.number(),
    d1General: v.number(),
    d2Research: v.number(),
    d2General: v.number(),
    d4Training: v.number(),
    d4General: v.number(),
    // Town Center level as the game reports it (31-35 = TG1, 36-40 = TG2, ...). Truegold is the amount held.
    // Optional so entries saved before these fields existed stay valid.
    tcLevel: v.optional(v.number()),
    truegold: v.optional(v.number()),
    d1Slots: v.array(v.number()),
    d2Slots: v.array(v.number()),
    d4Slots: v.array(v.number()),
    // Set by an admin once the player has been told their turns.
    informed: v.optional(v.boolean()),
  }).index("by_gameId", ["gameId"]),

  assignments: defineTable({
    day: dayValidator,
    slot: v.number(),
    gameId: v.string(),
    locked: v.boolean(),
  })
    .index("by_day_and_slot", ["day", "slot"])
    .index("by_gameId", ["gameId"]),

  // Results of looking up a game ID in the MightPulse API, so sign-up can trust them.
  // Kept for an hour; sign-up copies name, alliance and Town Center level from here.
  playerLookups: defineTable({
    gameId: v.string(),
    fetchedAt: v.number(),
    status: v.union(
      v.literal("ok"),
      v.literal("not_found"),
      v.literal("wrong_kingdom"),
      v.literal("wrong_alliance"),
    ),
    name: v.optional(v.string()),
    alliance: v.optional(v.string()),
    tcLevel: v.optional(v.number()),
    kid: v.optional(v.number()),
  }).index("by_gameId", ["gameId"]),

  // Latest member list of each alliance from the MightPulse API, for the admin "not signed up" list.
  rosters: defineTable({
    alliance: v.string(),
    fetchedAt: v.number(),
    members: v.array(v.object({ gameId: v.string(), name: v.string(), tcLevel: v.number(), rank: v.string() })),
  }).index("by_alliance", ["alliance"]),

  // Single row.
  settings: defineTable({
    eventName: v.string(),
    // No longer used: sign-ups are always open. Kept optional so rows written before the removal stay valid.
    submissionsOpen: v.optional(v.boolean()),
    schedulePublished: v.boolean(),
    // Day 1 of KvK prep as "YYYY-MM-DD" (UTC). Day 2 and Day 4 follow from it.
    startDate: v.optional(v.string()),
  }),
});
