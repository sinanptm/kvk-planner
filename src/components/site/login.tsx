"use client";

import { api } from "@convex/_generated/api";
import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from "@convex-dev/auth/methods/username-password/react";
import { useConvexAuth } from "convex/react";
import { Crown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const MIN_PASSWORD = 10;

// Readable messages for Convex Auth's error codes.
function authError(error: { error: string; minimumLength?: number; retryAfterMs?: number }) {
  switch (error.error) {
    case "INVALID_CREDENTIALS":
    case "USER_NOT_FOUND":
      return "Wrong email or password.";
    case "USERNAME_TAKEN":
      return "There's already an account with this email. Log in instead.";
    case "PASSWORD_TOO_SHORT":
      return `Use at least ${error.minimumLength ?? MIN_PASSWORD} characters for the password.`;
    case "PASSWORD_TOO_COMMON":
      return "That password is too common. Pick another one.";
    case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
      return "The password can't start or end with a space.";
    case "RATE_LIMITED":
      return `Too many tries. Wait ${Math.ceil((error.retryAfterMs ?? 60_000) / 1000)} seconds.`;
    default:
      return "Something went wrong. Try again.";
  }
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Log in or create an account. Accounts are for kingdom leaders; players never need one.
export function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/account";
  const { isAuthenticated } = useConvexAuth();
  const [mode, setMode] = useState<"signIn" | "signUp">(params.get("mode") === "signup" ? "signUp" : "signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn, pending: signingIn } = useSignInWithUsernamePassword(api.auth);
  const { signUp, pending: signingUp } = useSignUpWithUsernamePassword(api.auth);
  const pending = signingIn || signingUp;

  useEffect(() => {
    if (isAuthenticated) router.replace(next);
  }, [isAuthenticated, next, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const username = email.trim().toLowerCase();
    if (!isEmail(username)) return void toast.error("Enter your email address.");
    if (mode === "signUp" && password.length < MIN_PASSWORD)
      return void toast.error(`Use at least ${MIN_PASSWORD} characters for the password.`);
    const result = await (mode === "signIn" ? signIn : signUp)({ username, password });
    if (result.status !== "complete") toast.error(authError(result.userError as { error: string }));
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="items-center text-center">
        <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Crown className="size-6" />
        </span>
        <CardTitle className="text-xl">{mode === "signIn" ? "Log in" : "Create an account"}</CardTitle>
        <CardDescription>
          {mode === "signIn"
            ? "For kingdom leaders running KvK appointments."
            : "Free. Set up your kingdom right after. Players don’t need an account."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(["signIn", "signUp"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "h-9 rounded-lg text-sm font-medium text-muted-foreground transition-colors",
                mode === m && "bg-background text-foreground shadow-sm",
              )}
            >
              {m === "signIn" ? "Log in" : "Create account"}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
              required
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
              required
              disabled={pending}
            />
            {mode === "signUp" && (
              <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD} characters.</p>
            )}
          </div>
          <Button type="submit" className="mt-1 h-11 text-base" disabled={pending}>
            {pending ? "Please wait…" : mode === "signIn" ? "Log in" : "Create account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
