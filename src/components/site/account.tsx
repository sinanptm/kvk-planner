"use client";

import { api } from "@convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CalendarDays, CircleCheck, ClipboardPen, LogOut, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyText, errorMessage } from "@/lib/client";
import { MAX_ALLIANCES, cleanAlliances, isKingdomNumber, tcLabel } from "@/lib/kvk";
import { cn } from "@/lib/utils";

type Leader = FunctionReturnType<typeof api.kvk.lookup.leader>;

// The signed-in leader's kingdoms, and the form to set up a new one.
export function Account() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login?next=/account");
  }, [isLoading, isAuthenticated, router]);

  if (!isAuthenticated || me === undefined || me === null) return null;

  return (
    <>
      <PageHeader eyebrow="Account" title="My kingdoms" description={me.email ?? undefined}>
        <Button variant="outline" onClick={() => void signOut()}>
          <LogOut data-icon="inline-start" />
          Log out
        </Button>
      </PageHeader>

      {me.kingdoms.map((k) => (
        <KingdomCard key={k.number} number={k.number} alliances={k.alliances} />
      ))}

      {me.kingdoms.length < 3 && <CreateKingdom first={me.kingdoms.length === 0} />}
    </>
  );
}

function KingdomCard({ number, alliances }: { number: number; alliances: string[] }) {
  const link = typeof window === "undefined" ? `/${number}` : `${window.location.origin}/${number}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="font-mono">#{number}</span>
          <span className="text-sm font-normal text-muted-foreground">{alliances.join(" · ")}</span>
        </CardTitle>
        <CardDescription>
          Share the sign-up link with your players:{" "}
          <button
            type="button"
            onClick={() => copyText(link, "Link copied")}
            className="font-mono text-foreground underline decoration-dotted underline-offset-4"
          >
            {link.replace(/^https?:\/\//, "")}
          </button>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-3">
        <Link href={`/${number}/admin`} className={cn(buttonVariants(), "h-11")}>
          <ShieldCheck data-icon="inline-start" />
          Admin
        </Link>
        <Link href={`/${number}`} className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
          <ClipboardPen data-icon="inline-start" />
          Sign-up page
        </Link>
        <Link href={`/${number}/schedule`} className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
          <CalendarDays data-icon="inline-start" />
          Schedule
        </Link>
      </CardContent>
    </Card>
  );
}

// Two steps: prove you play in the kingdom (your game ID), then list the alliances that take part.
function CreateKingdom({ first }: { first: boolean }) {
  const router = useRouter();
  const checkLeader = useAction(api.kvk.lookup.leader);
  const create = useMutation(api.kvk.kingdoms.create);
  const [kingdom, setKingdom] = useState("");
  const [gameId, setGameId] = useState("");
  const [checked, setChecked] = useState<{ kingdom: string; gameId: string; result: Leader } | null>(null);
  const [alliances, setAlliances] = useState("");
  const [busy, setBusy] = useState(false);

  const number = Number(kingdom);
  const verified =
    checked?.kingdom === kingdom && checked.gameId === gameId.trim() && checked.result.status === "ok";

  const check = async (e: FormEvent) => {
    e.preventDefault();
    if (!isKingdomNumber(number)) return void toast.error("Enter your kingdom number.");
    if (!/^\d{3,15}$/.test(gameId.trim())) return void toast.error("Enter your game ID (numbers only).");
    setBusy(true);
    try {
      const result = await checkLeader({ kingdom: number, gameId: gameId.trim() });
      setChecked({ kingdom, gameId: gameId.trim(), result });
      if (result.status === "ok" && !alliances && result.alliance) setAlliances(result.alliance);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const tags = cleanAlliances(alliances.split(/[\s,]+/));
    if (!tags) return void toast.error(`Enter 1 to ${MAX_ALLIANCES} alliance tags, like VIK, TEA.`);
    setBusy(true);
    try {
      await create({ number, gameId: gameId.trim(), alliances: tags });
      toast.success(`Kingdom #${number} is ready.`);
      router.push(`/${number}/admin`);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  };

  const problem =
    checked && checked.result.status !== "ok"
      ? {
          not_found: "No player with this ID in the game. Check the number.",
          wrong_kingdom: `${checked.result.name} is in kingdom ${checked.result.kid}, not ${checked.kingdom}. You can only set up the kingdom you play in.`,
          wrong_alliance: "",
          pending: "The game is still looking this player up. Try again in a few seconds.",
          error: "Couldn't reach the game right now. Try again in a minute.",
        }[checked.result.status]
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{first ? "Set up your kingdom" : "Set up another kingdom"}</CardTitle>
        <CardDescription>
          We check your game ID to make sure you play in this kingdom. Takes a minute.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form onSubmit={check} className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
          <div className="flex flex-col gap-2">
            <Label htmlFor="kingdom">Kingdom</Label>
            <Input
              id="kingdom"
              inputMode="numeric"
              placeholder="2323"
              value={kingdom}
              onChange={(e) => setKingdom(e.target.value.replace(/\D/g, "").slice(0, 5))}
              className="h-11 font-mono"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="leader-id">Your game ID</Label>
            <Input
              id="leader-id"
              inputMode="numeric"
              placeholder="Your Kingshot player ID"
              value={gameId}
              onChange={(e) => setGameId(e.target.value.replace(/\D/g, "").slice(0, 15))}
              className="h-11 font-mono"
            />
          </div>
          <Button type="submit" variant={verified ? "outline" : "default"} className="h-11" disabled={busy}>
            <Search data-icon="inline-start" />
            {busy && !verified ? "Checking…" : "Check"}
          </Button>
        </form>

        {problem && (
          <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            {problem}
          </p>
        )}

        {verified && (
          <form onSubmit={submit} className="flex flex-col gap-4 border-t pt-5">
            <p className="flex items-center gap-2 text-sm">
              <CircleCheck className="size-4 text-success" />
              Found <span className="font-semibold">{checked.result.name}</span>
              <span className="text-muted-foreground">
                · {checked.result.alliance || "no alliance"}
                {checked.result.tcLevel ? ` · ${tcLabel(checked.result.tcLevel)}` : ""}
              </span>
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="alliances">Alliances taking part</Label>
              <Input
                id="alliances"
                placeholder="VIK, TEA, BTF"
                value={alliances}
                onChange={(e) => setAlliances(e.target.value)}
                className="h-11 font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Alliance tags, separated by commas. Only their members can sign up. You can change them later.
              </p>
            </div>
            <Button type="submit" className="h-11 text-base sm:self-start sm:px-8" disabled={busy}>
              {busy ? "Setting up…" : `Set up kingdom #${checked.kingdom}`}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
