"use client";

import { useConvexAuth } from "convex/react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Clock,
  Gift,
  Hand,
  Languages,
  Lock,
  MessageSquareText,
  Sparkles,
  UserSearch,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isKingdomNumber } from "@/lib/kvk";
import { cn } from "@/lib/utils";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: BadgeCheck,
    title: "Sign-ups checked against the game",
    body: "Players enter their game ID. Name, alliance and Town Center level come straight from the game, and only your alliances get in.",
  },
  {
    icon: Sparkles,
    title: "Auto-assign by speedups",
    body: "One click gives the turns to the players with the most speedups for each day, and keeps popular times open for those who need them.",
  },
  {
    icon: Hand,
    title: "Hand-pick any turn",
    body: "Tap a turn to see who picked that time, with their speedups, TC and Truegold. Anything you place by hand stays locked.",
  },
  {
    icon: Lock,
    title: "Preview before you change",
    body: "Auto-assign shows every change first. Nothing moves until you accept it.",
  },
  {
    icon: UserSearch,
    title: "See who hasn’t signed up",
    body: "Pull each alliance’s member list from the game and see who is missing, by Town Center level.",
  },
  {
    icon: MessageSquareText,
    title: "Ready-to-send turn messages",
    body: "Copy a player’s turns as a short message for in-game mail, then mark them as informed.",
  },
  {
    icon: Clock,
    title: "UTC and local times",
    body: "Every turn shows in UTC and in each player’s own time zone, with the dates of Day 1 and Day 4.",
  },
  {
    icon: Languages,
    title: "Seven languages",
    body: "English, Español, Bahasa Indonesia, 中文, Français, Türkçe and Deutsch for your players.",
  },
];

const STEPS = [
  { title: "Set up your kingdom", body: "Create a free account, enter your kingdom number, your game ID and your alliances." },
  { title: "Share one link", body: "Players open your kingdom’s page, check their game ID, and enter speedups and free times." },
  { title: "Assign and publish", body: "Auto-assign or hand-pick turns, then publish. Everyone sees their own turn." },
];

export function Landing() {
  const { isAuthenticated } = useConvexAuth();
  const setUpHref = isAuthenticated ? "/account" : "/login?mode=signup&next=/account";

  return (
    <div className="flex flex-col gap-16 sm:gap-20">
      {/* Hero */}
      <section className="flex flex-col items-start gap-6 pt-4 sm:pt-10">
        <p className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          For Kingshot kingdoms · Free
        </p>
        <h1 className="max-w-2xl text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
          KvK appointments, <span className="text-primary">sorted in minutes.</span>
        </h1>
        <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
          Collect speedups and free times from your players, give the Chief Minister and Noble Advisor turns to the
          right people, and publish the schedule — no spreadsheets.
        </p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link href={setUpHref} className={cn(buttonVariants(), "h-12 px-6 text-base")}>
            Set up your kingdom
            <ArrowRight data-icon="inline-end" />
          </Link>
          <Link href="#features" className={cn(buttonVariants({ variant: "outline" }), "h-12 px-6 text-base")}>
            See features
          </Link>
        </div>
      </section>

      <FindKingdom />

      {/* Features */}
      <section id="features" className="flex scroll-mt-20 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Everything a KvK appointment needs</h2>
          <p className="text-muted-foreground">Built by a kingdom leader, for kingdom leaders.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <Card key={title} size="sm">
              <CardContent className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="size-5" />
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-2 rounded-xl border bg-card p-5">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Support */}
      <section className="flex flex-col items-start gap-4 rounded-2xl border border-primary/30 bg-primary/10 p-6 sm:flex-row sm:items-center">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary">
          <Gift className="size-6" />
        </span>
        <div className="flex flex-1 flex-col gap-1">
          <h2 className="text-lg font-semibold">Free for every kingdom</h2>
          <p className="text-sm text-muted-foreground">
            If the tool saves your kingdom time, you can support it with a pack from the official Kingshot store.
          </p>
        </div>
        <Link href="/support" className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5")}>
          How to support
        </Link>
      </section>
    </div>
  );
}

// Players and leaders whose kingdom is already set up jump straight to it.
function FindKingdom() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const go = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(value);
    if (!isKingdomNumber(n)) return void toast.error("Enter a kingdom number, like 2323.");
    router.push(`/${n}`);
  };
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <CalendarClock className="size-5" />
          </span>
          <div>
            <p className="font-semibold">Signing up for your kingdom?</p>
            <p className="text-sm text-muted-foreground">Enter your kingdom number to open its page.</p>
          </div>
        </div>
        <form onSubmit={go} className="flex gap-2">
          <Input
            aria-label="Kingdom number"
            inputMode="numeric"
            placeholder="2323"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 5))}
            className="h-11 w-28 font-mono"
          />
          <Button type="submit" className="h-11 px-5">
            Go
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
