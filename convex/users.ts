import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";
import { isSuperAdmin } from "./lib/data";

// Called by Convex Auth when someone creates an account.
export const create = internalMutation({
  args: { method: v.object({ name: v.literal("usernamePassword"), profile: v.object({}) }) },
  returns: v.id("users"),
  handler: async (ctx) => ctx.db.insert("users", {}),
});

// The signed-in account: its email and the kingdoms it runs. Null when signed out.
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const [email, kingdoms] = await Promise.all([
      ctx.runQuery(components.authUsername.public.getUsername, { userId }),
      ctx.db
        .query("kingdoms")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", userId))
        .take(10),
    ]);
    return {
      email,
      isSuperAdmin: await isSuperAdmin(ctx),
      kingdoms: kingdoms.map((k) => ({ number: k.number, alliances: k.alliances, status: k.status })),
    };
  },
});
