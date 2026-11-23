import { ConvexError, v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { action, internalMutation, internalQuery, query } from "../_generated/server";
import { isAdmin, listPlayers, requireAdmin } from "../lib/data";
import { ALLIANCES, KINGDOM_ID } from "../lib/kvk";

// Game IDs are looked up in the MightPulse API (https://api.mightpulse.com) so sign-ups use the
// player's real name, alliance and Town Center level, and only members of our alliances in our
// kingdom can sign up. The key lives in the Convex env var MIGHTPULSE_API_KEY and never reaches the browser.

const API = "https://api.mightpulse.com/v1";
const LOOKUP_TTL_MS = 60 * 60 * 1000;

// Game IDs are digits; checked before calling the API so junk input costs nothing.
export const cleanLookupId = (raw: string) => {
  const id = raw.trim();
  if (!/^\d{3,15}$/.test(id)) throw new ConvexError("Enter your game ID (numbers only).");
  return id;
};

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

const lookupStatus = v.union(
  v.literal("ok"),
  v.literal("not_found"),
  v.literal("wrong_kingdom"),
  v.literal("wrong_alliance"),
);

const lookupResult = v.object({
  status: v.union(lookupStatus, v.literal("pending"), v.literal("error")),
  name: v.optional(v.string()),
  alliance: v.optional(v.string()),
  tcLevel: v.optional(v.number()),
  kid: v.optional(v.number()),
});
type LookupResult = Infer<typeof lookupResult>;

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
    status: lookupStatus,
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

const fromRow = (row: Doc<"playerLookups">): LookupResult => ({
  status: row.status,
  name: row.name,
  alliance: row.alliance,
  tcLevel: row.tcLevel,
  kid: row.kid,
});

// Looks a game ID up in the game (through MightPulse) and says whether it may sign up.
// Results are kept for an hour, so repeat checks of the same ID do not use the API.
export const player = action({
  args: { gameId: v.string() },
  returns: lookupResult,
  handler: async (ctx, args): Promise<LookupResult> => {
    const gameId = cleanLookupId(args.gameId);
    const cached: Doc<"playerLookups"> | null = await ctx.runQuery(internal.kvk.lookup.getLookup, { gameId });
    if (cached && Date.now() - cached.fetchedAt < LOOKUP_TTL_MS) return fromRow(cached);

    let res: { status: number; body: unknown };
    try {
      res = await callApi(`/players/${gameId}?include=base&wait=10`);
    } catch (err) {
      if (err instanceof ConvexError) throw err;
      return { status: "error" };
    }
    if (res.status === 202) return { status: "pending" };
    if (res.status === 404) {
      await ctx.runMutation(internal.kvk.lookup.storeLookup, { gameId, status: "not_found" });
      return { status: "not_found" };
    }
    if (res.status !== 200) return { status: "error" };

    const p = asRecord(asRecord(res.body).player);
    const name = asString(p.nick_name).trim();
    const alliance = asString(asRecord(p.alliance).abbr).trim().toUpperCase();
    const tcLevel = asNumber(p.town_center_level);
    const kid = asNumber(p.kid);
    const status =
      kid !== KINGDOM_ID
        ? "wrong_kingdom"
        : (ALLIANCES as readonly string[]).includes(alliance)
          ? "ok"
          : "wrong_alliance";
    const result = { status, name, alliance, tcLevel, kid } as const;
    await ctx.runMutation(internal.kvk.lookup.storeLookup, { gameId, ...result });
    return result;
  },
});

// ---- Admin: who in our alliances has not signed up yet ----

export const storeRoster = internalMutation({
  args: {
    alliance: v.string(),
    members: v.array(v.object({ gameId: v.string(), name: v.string(), tcLevel: v.number(), rank: v.string() })),
  },
  handler: async (ctx, { alliance, members }) => {
    const existing = await ctx.db
      .query("rosters")
      .withIndex("by_alliance", (q) => q.eq("alliance", alliance))
      .unique();
    const row = { alliance, members, fetchedAt: Date.now() };
    if (existing) await ctx.db.replace("rosters", existing._id, row);
    else await ctx.db.insert("rosters", row);
    return null;
  },
});

// Fetches the member list of each alliance (one API request per alliance).
export const refreshRosters = action({
  args: { password: v.string() },
  returns: v.object({ updated: v.array(v.string()), failed: v.array(v.string()) }),
  handler: async (ctx, { password }) => {
    requireAdmin(password);
    const updated: string[] = [];
    const failed: string[] = [];
    for (const tag of ALLIANCES) {
      let res: { status: number; body: unknown };
      try {
        res = await callApi(`/alliances/${KINGDOM_ID}/${tag}?include=roster`);
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
      await ctx.runMutation(internal.kvk.lookup.storeRoster, { alliance: tag, members });
      updated.push(tag);
    }
    return { updated, failed };
  },
});

// Each alliance's members from the game, marked with whether they have signed up. Null for a wrong password.
export const notSignedUp = query({
  args: { password: v.string() },
  handler: async (ctx, { password }) => {
    if (!isAdmin(password)) return null;
    const [players, rosters] = await Promise.all([listPlayers(ctx), ctx.db.query("rosters").take(ALLIANCES.length)]);
    const signedUp = new Set(players.map((p) => p.gameId));
    return ALLIANCES.map((tag) => {
      const roster = rosters.find((r) => r.alliance === tag);
      const members = (roster?.members ?? []).map((m) => ({ ...m, signedUp: signedUp.has(m.gameId) }));
      return {
        alliance: tag,
        fetchedAt: roster?.fetchedAt ?? null,
        total: members.length,
        signedUp: members.filter((m) => m.signedUp).length,
        members,
      };
    });
  },
});
