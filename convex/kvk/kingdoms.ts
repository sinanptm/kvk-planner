import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { cleanGameId, getKingdom, isDateString, publicKingdom, requireOwner } from "../lib/data";
import { cleanAlliances, isKingdomNumber, MAX_ALLIANCES } from "../lib/kvk";
import { LOOKUP_VALID_MS } from "./lookup";

const MAX_KINGDOMS_PER_ACCOUNT = 3;

// Public facts about a kingdom (null when nobody has set it up).
export const get = query({
  args: { number: v.number() },
  handler: async (ctx, { number }) => {
    const kingdom = await getKingdom(ctx, number);
    return kingdom ? publicKingdom(kingdom) : null;
  },
});

// Sets up a kingdom for the signed-in account. The leader's game ID must have been checked
// (lookup.leader) and be in this kingdom, so nobody can take a kingdom they don't play in.
export const create = mutation({
  args: { number: v.number(), gameId: v.string(), alliances: v.array(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Log in first.");
    if (!isKingdomNumber(args.number)) throw new ConvexError("Enter your kingdom number.");
    const alliances = cleanAlliances(args.alliances);
    if (!alliances) throw new ConvexError(`Enter 1 to ${MAX_ALLIANCES} alliance tags (letters and numbers, up to 4).`);

    if (await getKingdom(ctx, args.number))
      throw new ConvexError(`Kingdom ${args.number} is already set up. Ask its leader to give you access.`);
    const mine = await ctx.db
      .query("kingdoms")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", userId))
      .take(MAX_KINGDOMS_PER_ACCOUNT);
    if (mine.length >= MAX_KINGDOMS_PER_ACCOUNT)
      throw new ConvexError(`An account can run at most ${MAX_KINGDOMS_PER_ACCOUNT} kingdoms.`);

    const gameId = cleanGameId(args.gameId);
    const lookup = await ctx.db
      .query("playerLookups")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .unique();
    if (!lookup?.found || Date.now() - lookup.fetchedAt > LOOKUP_VALID_MS)
      throw new ConvexError("Check your game ID again first.");
    if (lookup.kid !== args.number)
      throw new ConvexError(`Your character is in kingdom ${lookup.kid}, not ${args.number}.`);

    await ctx.db.insert("kingdoms", {
      number: args.number,
      ownerId: userId,
      ownerGameId: gameId,
      alliances,
      schedulePublished: false,
    });
    return null;
  },
});

export const update = mutation({
  args: {
    kingdom: v.number(),
    schedulePublished: v.optional(v.boolean()),
    startDate: v.optional(v.string()),
    alliances: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { kingdom, schedulePublished, startDate, alliances }) => {
    const k = await requireOwner(ctx, kingdom);
    if (startDate !== undefined && !isDateString(startDate)) throw new ConvexError("Pick a valid date.");
    const tags = alliances === undefined ? undefined : cleanAlliances(alliances);
    if (tags === null) throw new ConvexError(`Enter 1 to ${MAX_ALLIANCES} alliance tags (letters and numbers, up to 4).`);
    await ctx.db.patch("kingdoms", k._id, {
      ...(schedulePublished !== undefined && { schedulePublished }),
      ...(startDate !== undefined && { startDate }),
      ...(tags !== undefined && { alliances: tags }),
    });
    return null;
  },
});
