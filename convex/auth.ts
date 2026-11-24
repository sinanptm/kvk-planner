import { setupConvexAuth } from "@convex-dev/auth/server";
import { setupUsernamePassword } from "@convex-dev/auth/methods/username-password/server";
import { components, internal } from "./_generated/api";

// Kingdom leaders sign in with an email address and a password. The email is the account's
// username (no verification email is sent). Players never sign in: they use their game ID.
const auth = setupConvexAuth({ component: components.auth });
export const { signOut, refreshSession, isAuthenticated } = auth;

export const { signUpWithUsernamePassword, signInWithUsernamePassword, changePassword } = setupUsernamePassword(
  auth,
  { component: components.authPassword, usernameComponent: components.authUsername },
).attachUserCallbacks({ createUser: internal.users.create });
