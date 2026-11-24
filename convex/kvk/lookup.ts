import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { action, internalMutation, internalQuery, query, type ActionCtx } from "../_generated/server";
import { cleanGameId, getKingdom, listPlayers, ownedKingdom, requireOwner } from "../lib/data";

// Game IDs are looked up in the MightPulse API (https://api.mightpulse.com) so sign-ups use the
// player's real name, alliance and Town Center level, and only members of a kingdom's alliances can
// sign up there. The key lives in the Convex env var MIGHTPULSE_API_KEY and never reaches the browser.

const API = "https://api.mightpulse.com/v1";
const LOOKUP_TTL_MS = 60 * 60 * 1000;
// How long a lookup stays good enough to sign up (or set up a kingdom) with.
export const LOOKUP_VALID_MS = 2 * 60 * 60 * 1000;

async function callApi(path: string): Promise<{ status: number; body: unknown }> {
  const key = process.env.MIGHTPULSE_API_KEY;
  if (!key) throw new ConvexError("MIGHTPULSE_API_KEY is not set in the Convex dashboard.");
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(40_000),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {}
  return { status: res.status, body };
}

const asRecord = (x: unknown): Record<string, unknown> =>
  x && typeof x === "object" ? (x as Record<string, unknown>) : {};
const asString = (x: unknown) => (typeof x === "string" ? x : typeof x === "number" ? String(x) : "");
const asNumber = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);

export const getLookup = internalQuery({
  args: { gameId: v.string() },
  handler: async (ctx, { gameId }) =>
    ctx.db
      .query("playerLookups")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .unique(),
});

export const storeLookup = internalMutation({
  args: {
    gameId: v.string(),
    found: v.boolean(),
    name: v.optional(v.string()),
    alliance: v.optional(v.string()),
    tcLevel: v.optional(v.number()),
    kid: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("playerLookups")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .unique();
    const row = { ...args, fetchedAt: Date.now() };
    if (existing) await ctx.db.replace("playerLookups", existing._id, row);
    else await ctx.db.insert("playerLookups", row);
    return null;
  },
});

type GamePlayer =
  | { kind: "found"; name: string; alliance: string; tcLevel: number; kid: number }
  | { kind: "not_found" | "pending" | "error" };

// What the game says about a game ID. Cached for an hour, so repeat checks cost no API calls.
async function fetchPlayer(ctx: ActionCtx, gameId: string): Promise<GamePlayer> {
  const cached: Doc<"playerLookups"> | null = await ctx.runQuery(internal.kvk.lookup.getLookup, { gameId });
  if (cached && Date.now() - cached.fetchedAt < LOOKUP_TTL_MS)
    return cached.found
      ? {
          kind: "found",
          name: cached.name ?? "",
          alliance: cached.alliance ?? "",
          tcLevel: cached.tcLevel ?? 0,
          kid: cached.kid ?? 0,
        }
      : { kind: "not_found" };

  let res: { status: number; body: unknown };
  try {
    res = await callApi(`/players/${gameId}?include=base&wait=10`);
  } catch (err) {
    if (err instanceof ConvexError) throw err;
    return { kind: "error" };
  }
  if (res.status === 202) return { kind: "pending" };
  if (res.status === 404) {
    await ctx.runMutation(internal.kvk.lookup.storeLookup, { gameId, found: false });
    return { kind: "not_found" };
  }
  if (res.status !== 200) return { kind: "error" };

  const p = asRecord(asRecord(res.body).player);
  const found = {
    name: asString(p.nick_name).trim(),
    alliance: asString(asRecord(p.alliance).abbr).trim().toUpperCase(),
    tcLevel: asNumber(p.town_center_level),
    kid: asNumber(p.kid),
  };
  await ctx.runMutation(internal.kvk.lookup.storeLookup, { gameId, found: true, ...found });
  return { kind: "found", ...found };
}

const lookupResult = v.object({
  status: v.union(
    v.literal("ok"),
    v.literal("not_found"),
    v.literal("wrong_kingdom"),
    v.literal("wrong_alliance"),
    v.literal("pending"),
    v.literal("error"),
  ),
  name: v.optional(v.string()),
  alliance: v.optional(v.string()),
  tcLevel: v.optional(v.number()),
  kid: v.optional(v.number()),
});
type LookupResult = Infer<typeof lookupResult>;

export const kingdomInfo = internalQuery({
  args: { kingdom: v.number() },
  handler: async (ctx, { kingdom }) => {
    const k = await getKingdom(ctx, kingdom);
    return k ? { alliances: k.alliances } : null;
  },
});

// Player sign-up: is this game ID a member of one of the kingdom's alliances?
export const player = action({
  args: { kingdom: v.number(), gameId: v.string() },
  returns: lookupResult,
  handler: async (ctx, args): Promise<LookupResult> => {
    const gameId = cleanGameId(args.gameId);
    const kingdom: { alliances: string[] } | null = await ctx.runQuery(internal.kvk.lookup.kingdomInfo, {
      kingdom: args.kingdom,
    });
    if (!kingdom) throw new ConvexError("This kingdom isn't set up.");
    const p = await fetchPlayer(ctx, gameId);
    if (p.kind !== "found") return { status: p.kind };
    const { kind: _, ...info } = p;
    const status =
      p.kid !== args.kingdom ? "wrong_kingdom" : kingdom.alliances.includes(p.alliance) ? "ok" : "wrong_alliance";
    return { status, ...info };
  },
});

export const signedIn = internalQuery({
  args: {},
  handler: async (ctx) => (await getAuthUserId(ctx)) !== null,
});

// Kingdom setup: is this game ID (the leader's own) in the kingdom being set up?
export const leader = action({
  args: { kingdom: v.number(), gameId: v.string() },
  returns: lookupResult,
  handler: async (ctx, args): Promise<LookupResult> => {
    const signedIn: boolean = await ctx.runQuery(internal.kvk.lookup.signedIn, {});
    if (!signedIn) throw new ConvexError("Log in first.");
    const gameId = cleanGameId(args.gameId);
    const p = await fetchPlayer(ctx, gameId);
    if (p.kind !== "found") return { status: p.kind };
    const { kind: _, ...info } = p;
    return { status: p.kid === args.kingdom ? "ok" : "wrong_kingdom", ...info };
  },
});

// ---- Admin: who in the kingdom's alliances has not signed up yet ----

export const ownerAlliances = internalQuery({
  args: { kingdom: v.number() },
  handler: async (ctx, { kingdom }) => (await requireOwner(ctx, kingdom)).alliances,
});

export const storeRoster = internalMutation({
  args: {
    kingdom: v.number(),
    alliance: v.string(),
    members: v.array(v.object({ gameId: v.string(), name: v.string(), tcLevel: v.number(), rank: v.string() })),
  },
  handler: async (ctx, { kingdom, alliance, members }) => {
    const existing = await ctx.db
      .query("rosters")
      .withIndex("by_kingdom_and_alliance", (q) => q.eq("kingdom", kingdom).eq("alliance", alliance))
      .unique();
    const row = { kingdom, alliance, members, fetchedAt: Date.now() };
    if (existing) await ctx.db.replace("rosters", existing._id, row);
    else await ctx.db.insert("rosters", row);
    return null;
  },
});

// Fetches the member list of each of the kingdom's alliances (one API request per alliance).
export const refreshRosters = action({
  args: { kingdom: v.number() },
  returns: v.object({ updated: v.array(v.string()), failed: v.array(v.string()) }),
  handler: async (ctx, { kingdom }) => {
    const alliances: string[] = await ctx.runQuery(internal.kvk.lookup.ownerAlliances, { kingdom });
    const updated: string[] = [];
    const failed: string[] = [];
    for (const tag of alliances) {
      let res: { status: number; body: unknown };
      try {
        res = await callApi(`/alliances/${kingdom}/${encodeURIComponent(tag)}?include=roster`);
      } catch (err) {
        if (err instanceof ConvexError) throw err;
        failed.push(tag);
        continue;
      }
      const raw = asRecord(res.body).members;
      if (res.status !== 200 || !Array.isArray(raw)) {
        failed.push(tag);
        continue;
      }
      const members = raw.map((m) => {
        const r = asRecord(m);
        return {
          gameId: asString(r.governor_id),
          name: asString(r.nick_name).trim(),
          tcLevel: asNumber(r.town_center_level),
          rank: asString(r.alliance_rank_label),
        };
      });
      await ctx.runMutation(internal.kvk.lookup.storeRoster, { kingdom, alliance: tag, members });
      updated.push(tag);
    }
    return { updated, failed };
  },
});

// Each alliance's members from the game, marked with whether they have signed up. Null unless the
// signed-in account runs this kingdom.
export const notSignedUp = query({
  args: { kingdom: v.number() },
  handler: async (ctx, { kingdom }) => {
    const k = await ownedKingdom(ctx, kingdom);
    if (!k) return null;
    const players = await listPlayers(ctx, kingdom);
    const signedUp = new Set(players.map((p) => p.gameId));
    return Promise.all(
      k.alliances.map(async (tag) => {
        const roster = await ctx.db
          .query("rosters")
          .withIndex("by_kingdom_and_alliance", (q) => q.eq("kingdom", kingdom).eq("alliance", tag))
          .unique();
        const members = (roster?.members ?? []).map((m) => ({ ...m, signedUp: signedUp.has(m.gameId) }));
        return {
          alliance: tag,
          fetchedAt: roster?.fetchedAt ?? null,
          total: members.length,
          signedUp: members.filter((m) => m.signedUp).length,
          members,
        };
      }),
    );
  },
});
