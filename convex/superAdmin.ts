import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { getKingdom, isSuperAdmin, listPlayers, requireSuperAdmin } from "./lib/data";
import { kingdomStatusValidator } from "./schema";

// The developer's page: every kingdom that has been set up, newest first, to approve or reject.
// Null for anyone who isn't a super admin (see SUPER_ADMIN_EMAILS).
export const overview = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSuperAdmin(ctx))) return null;
    const kingdoms = await ctx.db.query("kingdoms").order("desc").take(500);
    return Promise.all(
      kingdoms.map(async (k) => {
        const [email, players, lookup] = await Promise.all([
          ctx.runQuery(components.authUsername.public.getUsername, { userId: k.ownerId }),
          listPlayers(ctx, k.number),
          ctx.db
            .query("playerLookups")
            .withIndex("by_gameId", (q) => q.eq("gameId", k.ownerGameId))
            .unique(),
        ]);
        return {
          number: k.number,
          status: k.status,
          createdAt: k._creationTime,
          ownerEmail: email,
          ownerGameId: k.ownerGameId,
          ownerName: lookup?.name ?? null,
          ownerAlliance: lookup?.alliance ?? null,
          alliances: k.alliances,
          players: players.length,
        };
      }),
    );
  },
});

// Approve (opens the kingdom), reject, or move back to waiting.
export const setStatus = mutation({
  args: { kingdom: v.number(), status: kingdomStatusValidator },
  handler: async (ctx, { kingdom, status }) => {
    await requireSuperAdmin(ctx);
    const k = await getKingdom(ctx, kingdom);
    if (!k) throw new ConvexError("Kingdom not found.");
    await ctx.db.patch("kingdoms", k._id, { status });
    return null;
  },
});

// Removes a kingdom and everything in it, so its number can be set up again.
export const deleteKingdom = mutation({
  args: { kingdom: v.number() },
  handler: async (ctx, { kingdom }) => {
    await requireSuperAdmin(ctx);
    const k = await getKingdom(ctx, kingdom);
    if (!k) return null;
    for (const p of await listPlayers(ctx, kingdom)) await ctx.db.delete("players", p._id);
    const turns = await ctx.db
      .query("assignments")
      .withIndex("by_kingdom_and_day_and_slot", (q) => q.eq("kingdom", kingdom))
      .take(1000);
    for (const t of turns) await ctx.db.delete("assignments", t._id);
    const rosters = await ctx.db
      .query("rosters")
      .withIndex("by_kingdom_and_alliance", (q) => q.eq("kingdom", kingdom))
      .take(100);
    for (const r of rosters) await ctx.db.delete("rosters", r._id);
    await ctx.db.delete("kingdoms", k._id);
    return null;
  },
});
