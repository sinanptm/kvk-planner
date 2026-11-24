import { v } from "convex/values";
import { query } from "../_generated/server";
import { getKingdom, getPlayer, listAllTurns } from "../lib/data";

// A kingdom's public, read-only schedule. Null until its admin publishes it. Speedups are not exposed.
export const published = query({
  args: { kingdom: v.number() },
  handler: async (ctx, { kingdom }) => {
    const k = await getKingdom(ctx, kingdom);
    if (!k?.schedulePublished) return null;
    const turns = await listAllTurns(ctx, kingdom);
    const rows = await Promise.all(
      turns.map(async (t) => {
        const player = await getPlayer(ctx, kingdom, t.gameId);
        return { day: t.day, slot: t.slot, name: player?.name ?? "Unknown", alliance: player?.alliance ?? "" };
      }),
    );
    return { turns: rows };
  },
});
