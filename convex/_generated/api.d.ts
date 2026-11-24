/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as kvk_admin from "../kvk/admin.js";
import type * as kvk_kingdoms from "../kvk/kingdoms.js";
import type * as kvk_lookup from "../kvk/lookup.js";
import type * as kvk_players from "../kvk/players.js";
import type * as kvk_schedule from "../kvk/schedule.js";
import type * as lib_data from "../lib/data.js";
import type * as lib_kvk from "../lib/kvk.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "kvk/admin": typeof kvk_admin;
  "kvk/kingdoms": typeof kvk_kingdoms;
  "kvk/lookup": typeof kvk_lookup;
  "kvk/players": typeof kvk_players;
  "kvk/schedule": typeof kvk_schedule;
  "lib/data": typeof lib_data;
  "lib/kvk": typeof lib_kvk;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  authPassword: import("@convex-dev/auth/components/password/_generated/component.js").ComponentApi<"authPassword">;
  authUsername: import("@convex-dev/auth/components/username/_generated/component.js").ComponentApi<"authUsername">;
};
