"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { ArrowRight, Ban, Check, ChevronDown, Info, Lock, LockOpen, Search, Sparkles, Trash2, Undo2, UserCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from "@/components/ui/select";
import { errorMessage } from "@/lib/client";
import {
  DAYS,
  ALLIANCES,
  ALLIANCE_STYLES,
  SLOTS,
  SLOTS_KEY,
  assignDay,
  dayScore,
  formatDuration,
  formatTruegold,
  formatSlotLocal,
  playerLabel,
  rankPlayers,
  rankScore,
  MINUTES_PER_TG,
  searchPlayers,
  slotRangeUtc,
  slotUtc,
  tcLabel,
  useToday,
  type DayKey,
  dayDate,
} from "@/lib/kvk";
import { cn } from "@/lib/utils";
import type { Dashboard } from "./admin";
import { PlayerName } from "./alliance-tag";
import { ConfirmButton } from "./confirm-button";

const EMPTY = "__empty";

// Speedups in two units at most ("22d 21h", "5h 30m"), so the dropdown column stays narrow.
const shortDuration = (minutes: number) => formatDuration(minutes).split(" ").slice(0, 2).join(" ");

// UTC quarters of the day, 12 turns each.
const PERIODS = ["00:00–06:00", "06:00–12:00", "12:00–18:00", "18:00–24:00"].map((label, i) => ({
  label,
  slots: SLOTS.slice(i * 12, i * 12 + 12),
}));

export function AdminDay({ password, day, data }: { password: string; day: DayKey; data: Dashboard }) {
  const autoAssign = useMutation(api.kvk.admin.autoAssign);
  const setTurn = useMutation(api.kvk.admin.setTurn);
  const setLocked = useMutation(api.kvk.admin.setLocked);
  const clearDay = useMutation(api.kvk.admin.clearDay);
  const [assigning, setAssigning] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const today = useToday();

  const { players, turns } = data;
  const byId = useMemo(() => new Map(players.map((p) => [p.gameId, p])), [players]);
  const bySlot = useMemo(() => new Map(turns.filter((t) => t.day === day).map((t) => [t.slot, t])), [turns, day]);
  const turnOf = useMemo(() => new Map([...bySlot.values()].map((t) => [t.gameId, t.slot])), [bySlot]);
  const ranked = useMemo(() => rankPlayers(players, day), [players, day]);

  // Highest speedups for this day first; earlier sign-up wins ties.
  const sorted = useMemo(
    () =>
      [...players].sort(
        (a, b) =>
          rankScore(b, day) - rankScore(a, day) ||
          dayScore(b, day) - dayScore(a, day) ||
          a._creationTime - b._creationTime,
      ),
    [players, day],
  );

  // For each turn, the players who picked that time, in the order above.
  const pickedBy = useMemo(() => {
    const map = new Map<number, typeof sorted>(SLOTS.map((slot) => [slot, []]));
    // Players excluded from this day aren't offered for the times they picked.
    for (const p of sorted)
      if (!p.excluded?.includes(day)) for (const slot of p[SLOTS_KEY[day]]) map.get(slot)?.push(p);
    return map;
  }, [sorted, day]);

  // One dropdown row: name on the left, speedups for this day on the right.
  // Players who already hold another turn are dimmed and show where they would move from.
  const optionItem = (p: (typeof sorted)[number], slot: number) => {
    const held = turnOf.get(p.gameId);
    const elsewhere = held !== undefined && held !== slot;
    return (
      <SelectItem key={p.gameId} value={p.gameId}>
        <PlayerName player={p} className={cn("flex-1", elsewhere && "opacity-60")} />
        {elsewhere && (
          <span className="rounded bg-muted px-1.5 text-[11px] text-muted-foreground">at {slotUtc(held)}</span>
        )}
        {day === "d1" && (
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {p.tcLevel ? tcLabel(p.tcLevel) : "TC ?"} · {formatTruegold(p.truegold)} TG
          </span>
        )}
        <span className="w-16 shrink-0 text-right font-mono text-xs font-medium tabular-nums">
          {day === "d1" ? `${tgPoints(rankScore(p, day))} TG` : shortDuration(dayScore(p, day))}
        </span>
      </SelectItem>
    );
  };

  // The dropdown for one turn: free players who picked the time, then ones already placed elsewhere,
  // and (only when the switch is on) everyone who did not pick it.
  const optionGroups = (slot: number) => {
    const current = bySlot.get(slot)?.gameId;
    const isFree = (p: (typeof sorted)[number]) => !turnOf.has(p.gameId) || p.gameId === current;
    const onTurn = sorted.filter((p) => p.gameId === current);
    const picked = (pickedBy.get(slot) ?? []).filter((p) => p.gameId !== current);
    const pickedIds = new Set(picked.map((p) => p.gameId));
    // The player on this turn is always listed first, in either view, even if they didn't pick
    // this time. Without it the dropdown has no matching option and can wipe the turn.
    const groups = [
      { label: "On this turn", players: onTurn },
      { label: "Picked this time", players: picked.filter(isFree) },
      { label: "Picked this time · already has a turn", players: picked.filter((p) => !isFree(p)) },
      {
        label: "Didn\u2019t pick this time",
        players: showAll ? sorted.filter((p) => !pickedIds.has(p.gameId) && p.gameId !== current) : [],
      },
    ].filter((g) => g.players.length > 0);
    return (
      <>
        <SelectItem value={EMPTY}>
          <span className="text-muted-foreground">Empty</span>
        </SelectItem>
        {/* A plain element: SelectLabel throws when rendered outside a SelectGroup. */}
        {groups.length === 0 && (
          <p className="px-1.5 py-1 text-xs text-muted-foreground">Nobody picked this time</p>
        )}
        {groups.map((g) => (
          <SelectGroup key={g.label}>
            <SelectSeparator />
            <SelectLabel>{g.label}</SelectLabel>
            {g.players.map((p) => optionItem(p, slot))}
          </SelectGroup>
        ))}
      </>
    );
  };

  // What auto-assign would do right now, computed with the same logic the server runs.
  // Only turns whose player would change are listed.
  const plan = useMemo(() => {
    const locked = [...bySlot.values()].filter((t) => t.locked);
    const { turns: next, waitlist } = assignDay(players, day, locked);
    const nextBySlot = new Map(next.map((t) => [t.slot, t.gameId]));
    const changes = SLOTS.flatMap((slot) => {
      const from = bySlot.get(slot)?.gameId;
      const to = nextBySlot.get(slot);
      return from === to ? [] : [{ slot, from, to }];
    });
    // Why each player lands where they do: their rank, and how many ranked players picked each time.
    const rankOf = new Map(ranked.map((r, i) => [r.player.gameId, i + 1]));
    const demand = new Array<number>(SLOTS.length).fill(0);
    for (const r of ranked) for (const s of r.slots) demand[s]++;
    return { changes, filled: next.length, waitlist, rankOf, demand };
  }, [players, day, bySlot, ranked]);

  // A player's ranking value in words: usable TG on Day 1, speedups on other days.
  const scoreText = (gameId: string) => {
    const p = byId.get(gameId);
    if (!p) return "";
    return day === "d1" ? `${tgPoints(rankScore(p, day))} usable TG` : shortDuration(dayScore(p, day));
  };

  const nameOf = (gameId: string | undefined) => {
    if (gameId === undefined) return null;
    const p = byId.get(gameId);
    return p ? playerLabel(p) : "Unknown";
  };

  const playerNode = (gameId: string | undefined) => {
    if (gameId === undefined) return null;
    const p = byId.get(gameId);
    return p ? <PlayerName player={p} className="max-w-full" /> : "Unknown";
  };

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) toast.success(done);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const runAutoAssign = async () => {
    setAssigning(true);
    await run(async () => {
      const res = await autoAssign({ password, day });
      toast.success(`${res.filled}/${SLOTS.length} turns filled · ${res.waitlisted} on waitlist`);
    });
    setAssigning(false);
    setPreviewing(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">
          {DAYS[day].label} · {DAYS[day].title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {dayDate(data.settings.startDate, day, "en", true) && `${dayDate(data.settings.startDate, day, "en", true)} · `}
          {DAYS[day].position}. Score = {DAYS[day].scoreHint.toLowerCase()}.
        </p>
      </div>

      <div className="flex gap-2">
        {plan.changes.length > 0 ? (
          <Button className="h-10 min-w-0 flex-1 sm:flex-none" onClick={() => setPreviewing(true)}>
            <Sparkles data-icon="inline-start" />
            Auto-assign · {plan.changes.length} {plan.changes.length === 1 ? "change" : "changes"}
          </Button>
        ) : (
          <Button variant="outline" className="h-10 min-w-0 flex-1 sm:flex-none" disabled>
            <Check data-icon="inline-start" />
            Auto-assign · nothing to change
          </Button>
        )}
        <ConfirmButton
          title={`Clear ${DAYS[day].label}?`}
          description="Removes every turn on this day, including locked ones. Players stay signed up."
          actionLabel="Clear day"
          className="h-10"
          onConfirm={() => run(() => clearDay({ password, day }), `${DAYS[day].label} cleared.`)}
        >
          <Trash2 data-icon="inline-start" />
          Clear day
        </ConfirmButton>
      </div>
      </div>

      <AlertDialog open={previewing} onOpenChange={setPreviewing}>
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto data-[size=default]:sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Auto-assign {DAYS[day].label}: {plan.changes.length} {plan.changes.length === 1 ? "change" : "changes"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Nothing is saved until you apply. After this, {plan.filled}/{SLOTS.length} turns are filled and{" "}
              {plan.waitlist.length} {plan.waitlist.length === 1 ? "player is" : "players are"} on the waitlist.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* How the picking works, in the order it happens. Closed until tapped. */}
          <details className="group rounded-lg border bg-muted/40 text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              <Info className="size-4 shrink-0" />
              How does auto-assign pick?
              <ChevronDown className="ml-auto size-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <ol className="flex list-decimal flex-col gap-1.5 px-3 pb-3 pl-8 text-muted-foreground">
              <li>
                <span className="text-foreground">Locked turns stay.</span> Players you placed or locked keep their turn.
              </li>
              <li>
                <span className="text-foreground">Players are ranked</span>{" "}
                {day === "d1"
                  ? `by usable Truegold: the lower of their TG and their speedup minutes ÷ ${MINUTES_PER_TG}.`
                  : "by their speedups for this day."}{" "}
                Ties go to more speedups, then earlier sign-up. Excluded players and those who skipped the day are left out.
              </li>
              <li>
                <span className="text-foreground">From #1 down, each player gets one turn</span> from the times they
                picked that is still free. If several are free, they get the one the fewest other players picked, so
                busy times stay open for people with no other choice.
              </li>
              <li>
                <span className="text-foreground">Nothing free?</span> The player goes on the waitlist.
              </li>
            </ol>
          </details>

          <ul className="flex max-h-64 flex-col divide-y overflow-y-auto rounded-lg border text-sm">
            {plan.changes.map(({ slot, from, to }) => (
              <li key={slot} className="flex flex-col gap-0.5 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 font-mono font-semibold">{slotUtc(slot)}</span>
                  <span
                    className={cn("min-w-0 flex-1 truncate", from ? "line-through opacity-60" : "text-muted-foreground")}
                  >
                    {playerNode(from) ?? "Empty"}
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className={cn("min-w-0 flex-1 truncate", to ? "font-medium text-primary" : "text-muted-foreground")}>
                    {playerNode(to) ?? "Empty"}
                  </span>
                </div>
                {to && (
                  <p className="pl-14 text-xs text-muted-foreground">
                    #{plan.rankOf.get(to)} · {scoreText(to)} · picked {byId.get(to)?.[SLOTS_KEY[day]].length ?? 0}{" "}
                    times · {plan.demand[slot]} {plan.demand[slot] === 1 ? "player" : "players"} wanted {slotUtc(slot)}
                  </p>
                )}
              </li>
            ))}
          </ul>

          {plan.waitlist.length > 0 && (
            <div className="text-sm">
              <p className="mb-1 font-medium">Waitlist ({plan.waitlist.length})</p>
              <p className="text-xs text-muted-foreground">
                All their picked times are taken by higher-ranked players:{" "}
                {plan.waitlist.map((id) => `${nameOf(id)} (#${plan.rankOf.get(id)})`).join(", ")}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={assigning} onClick={runAutoAssign}>
              {assigning ? "Assigning…" : "Apply changes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,30%)]">
      <Card>
        <CardHeader>
          <CardTitle>Turns</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Who can I choose from?</p>
              <p className="text-xs text-muted-foreground">
                {showAll
                  ? "Every player is listed for every turn, even if they didn\u2019t pick that time."
                  : "Each turn lists only the players who picked that time."}
              </p>
            </div>
            <div role="group" aria-label="Who to list for each turn" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {[
                { all: false, label: "Picked the time", icon: UserCheck },
                { all: true, label: "Everyone", icon: Users },
              ].map(({ all, label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={showAll === all}
                  onClick={() => setShowAll(all)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                    showAll === all
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {ALLIANCES.map((tag) => (
              <li key={tag} className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", ALLIANCE_STYLES[tag].dot)} />
                <span className="font-mono font-semibold text-foreground">{tag}</span>
                {[...bySlot.values()].filter((t) => byId.get(t.gameId)?.alliance === tag).length} turns
              </li>
            ))}
          </ul>
          {PERIODS.map((period) => (
            <div key={period.label} className="flex flex-col gap-2">
              <p className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>{period.label} UTC</span>
                <span>
                  {period.slots.filter((slot) => bySlot.has(slot)).length}/{period.slots.length} filled
                </span>
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-6">
                {period.slots.map((slot) => {
                  const turn = bySlot.get(slot);
                  const player = turn && byId.get(turn.gameId);
                  const picked = pickedBy.get(slot) ?? [];
                  return (
                    <div key={slot} className="relative">
                      <Select
                        value={turn?.gameId ?? EMPTY}
                        onValueChange={(v) => {
                          // Act only on a real change: re-selecting the current player, or the
                          // dropdown resetting itself, must never clear or move a turn.
                          if (!v) return; // a reset, not a choice; only "Empty" clears a turn
                          const next = v === EMPTY ? null : v;
                          if (next === (turn?.gameId ?? null)) return;
                          void run(() => setTurn({ password, day, slot, gameId: next }));
                        }}
                      >
                        <SelectTrigger
                          aria-label={`${slotRangeUtc(slot)} UTC: ${turn ? (nameOf(turn.gameId) ?? "") : "empty"}`}
                          className={cn(
                            "h-auto! w-full flex-col items-stretch gap-0.5 p-2.5 text-left whitespace-normal [&>svg]:hidden",
                            turn
                              ? (ALLIANCE_STYLES[player?.alliance ?? ""]?.tile ??
                                "border-primary/40 bg-primary/10 hover:bg-primary/15 dark:bg-primary/10 dark:hover:bg-primary/15")
                              : picked.length > 0
                                ? "border-dashed border-primary/50"
                                : "border-dashed",
                          )}
                        >
                          <div className={cn("flex items-baseline gap-1.5", turn && "pr-7")}>
                            <span className="font-mono text-sm font-semibold">{slotUtc(slot)}</span>
                            {today && (
                              <span className="text-[11px] text-muted-foreground">{formatSlotLocal(slot, today)}</span>
                            )}
                          </div>
                          <div className={cn("truncate text-sm", turn ? "font-medium" : "text-muted-foreground")}>
                            {turn ? playerNode(turn.gameId) : "Empty"}
                          </div>
                          <div className={cn("text-xs", !turn && picked.length > 0 ? "text-primary" : "text-muted-foreground")}>
                            {player
                              ? `${shortDuration(dayScore(player, day))}${
                                  day === "d1"
                                    ? ` · ${player.tcLevel ? tcLabel(player.tcLevel) : "TC ?"} · ${formatTruegold(player.truegold)} TG`
                                    : ""
                                }`
                              : turn
                                ? "—"
                                : `${picked.length} picked`}
                          </div>
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false} align="start" className="min-w-[min(26rem,calc(100vw-2rem))]!">
                          {optionGroups(slot)}
                        </SelectContent>
                      </Select>
                      {turn && (
                        <Button
                          variant={turn.locked ? "default" : "ghost"}
                          size="icon-sm"
                          className="absolute top-1.5 right-1.5 size-6"
                          aria-label={turn.locked ? "Unlock turn" : "Lock turn"}
                          onClick={() => run(() => setLocked({ password, day, slot, locked: !turn.locked }))}
                        >
                          {turn.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5 text-muted-foreground" />}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <RankingCard
        password={password}
        day={day}
        players={players}
        ranked={ranked}
        turnOf={turnOf}
        ownerOf={(slot) => bySlot.get(slot)?.gameId}
      />
      </div>
    </div>
  );
}

type Ranked = ReturnType<typeof rankPlayers<Dashboard["players"][number]>>[number];
type RankStatus = "all" | "turn" | "waiting" | "excluded";

// Day 1 ranks by usable Truegold; shown as a whole number.
const tgPoints = (n: number) => Math.floor(n).toLocaleString("en-US");

// The day's ranking, with filters. Sits beside the turns on wide screens and scrolls on its own.
function RankingCard({
  password,
  day,
  players,
  ranked,
  turnOf,
  ownerOf,
}: {
  password: string;
  day: DayKey;
  players: Dashboard["players"];
  ranked: Ranked[];
  turnOf: Map<string, number>;
  // Who holds each turn this day, to show which of a player's picked times are still free.
  ownerOf: (slot: number) => string | undefined;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const nameById = new Map(players.map((p) => [p.gameId, p.name]));
  const setExcluded = useMutation(api.kvk.admin.setExcluded);
  const toggleExcluded = async (p: Dashboard["players"][number], excluded: boolean) => {
    try {
      await setExcluded({ password, gameId: p.gameId, day, excluded });
      toast.success(
        excluded ? `${p.name} won't get a ${DAYS[day].label} turn.` : `${p.name} is back in the ${DAYS[day].label} ranking.`,
      );
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const [search, setSearch] = useState("");
  const [alliance, setAlliance] = useState<string | null>(null);
  const [status, setStatus] = useState<RankStatus>("all");

  // Keep each player's real rank, so filtering never renumbers the list.
  const rows = ranked.map((r, i) => ({ ...r, rank: (i + 1) as number | null, excluded: false }));
  // Players an admin took off this day (they picked times but get no turn), listed under "Excluded".
  const excludedRows = players
    .filter((p) => p.excluded?.includes(day) && p[SLOTS_KEY[day]].length > 0)
    .map((p) => ({
      player: p,
      points: rankScore(p, day),
      score: dayScore(p, day),
      slots: p[SLOTS_KEY[day]],
      rank: null as number | null,
      excluded: true,
    }));
  const withTurn = rows.filter((r) => turnOf.has(r.player.gameId)).length;
  const pool = status === "excluded" ? excludedRows : rows;
  const matches = searchPlayers(
    pool.map((r) => ({ ...r, name: r.player.name, alliance: r.player.alliance, gameId: r.player.gameId })),
    search,
  );
  const shown = matches.filter(
    (r) =>
      (!alliance || r.player.alliance === alliance) &&
      (status === "all" || status === "excluded" || (status === "turn") === turnOf.has(r.player.gameId)),
  );
  const filtered = shown.length !== pool.length;
  const statuses: { key: RankStatus; label: string; count: number }[] = [
    { key: "all", label: "All", count: rows.length },
    { key: "turn", label: "Has turn", count: withTurn },
    { key: "waiting", label: "Waiting", count: rows.length - withTurn },
    { key: "excluded", label: "Excluded", count: excludedRows.length },
  ];

  return (
    <Card className="xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-hidden">
      <CardHeader>
        <CardTitle>Ranking ({filtered ? `${shown.length} of ${pool.length}` : pool.length})</CardTitle>
        <CardDescription>
          {day === "d1"
            ? `Most usable Truegold first: the lower of TG held and construction + general speedup minutes ÷ ${MINUTES_PER_TG}.`
            : "Most speedups first."}{" "}
          Ties go to more speedups, then who signed up first. Use the ban button to keep someone off this day.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search ranking"
            placeholder="Search name or ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <div role="group" aria-label="Filter by turn" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
          {statuses.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              aria-pressed={status === key}
              onClick={() => setStatus(key)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                status === key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label} · {count}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Filter by alliance" className="flex flex-wrap gap-1">
          {ALLIANCES.map((tag) => {
            const on = alliance === tag;
            const count = rows.filter((r) => r.player.alliance === tag).length;
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                disabled={count === 0 && !on}
                onClick={() => setAlliance(on ? null : tag)}
                className={cn(
                  "flex h-7 items-center gap-1 rounded-md border px-2 font-mono text-xs font-semibold transition-colors disabled:opacity-40",
                  on ? ALLIANCE_STYLES[tag].tile : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn("size-1.5 rounded-full", ALLIANCE_STYLES[tag].dot)} />
                {tag}
                <span className="font-sans font-normal">{count}</span>
              </button>
            );
          })}
        </div>
        <ol className="-mx-4 flex min-h-0 flex-col divide-y overflow-y-auto border-t px-4">
          {shown.map((r) => {
            const slot = turnOf.get(r.player.gameId);
            return (
              <li key={r.player.gameId} className="flex flex-col">
              <div className={cn("flex items-center gap-3 py-2.5", r.excluded && "opacity-70")}>
                <span className="w-6 shrink-0 font-mono text-sm text-muted-foreground">{r.rank ?? "—"}</span>
                <button
                  type="button"
                  aria-expanded={openId === r.player.gameId}
                  title="Show picked times"
                  onClick={() => setOpenId(openId === r.player.gameId ? null : r.player.gameId)}
                  className="flex min-w-0 flex-1 flex-col rounded-md text-left outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <PlayerName player={r.player} className="max-w-full font-medium" />
                  <span className="text-xs text-muted-foreground">
                    {day === "d1" && (
                      <span className="font-medium text-foreground">{tgPoints(r.points)} usable TG · </span>
                    )}
                    {shortDuration(r.score)} · {r.player.tcLevel ? tcLabel(r.player.tcLevel) : "TC ?"} ·{" "}
                    {formatTruegold(r.player.truegold)} TG · {r.slots.length} {r.slots.length === 1 ? "time" : "times"}
                  </span>
                </button>
                {r.excluded ? (
                  <Badge variant="secondary">Excluded</Badge>
                ) : slot !== undefined ? (
                  <Badge variant="success">Turn {slotUtc(slot)}</Badge>
                ) : (
                  <Badge variant="warning">Waiting</Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label={r.excluded ? `Put ${r.player.name} back on ${DAYS[day].label}` : `Exclude ${r.player.name} from ${DAYS[day].label}`}
                  title={r.excluded ? `Put back on ${DAYS[day].label}` : `Exclude from ${DAYS[day].label}`}
                  onClick={() => toggleExcluded(r.player, !r.excluded)}
                >
                  {r.excluded ? <Undo2 /> : <Ban className="text-muted-foreground" />}
                </Button>
              </div>
              {openId === r.player.gameId && (
                <div className="mb-2.5 ml-9 flex flex-col gap-1.5 rounded-lg bg-muted/40 p-2.5">
                  <p className="text-xs text-muted-foreground">
                    Picked {r.slots.length} {r.slots.length === 1 ? "time" : "times"} (UTC)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.slots.map((s) => {
                      const owner = ownerOf(s);
                      const mine = owner === r.player.gameId;
                      return (
                        <span
                          key={s}
                          title={mine ? "Their turn" : owner ? `Taken by ${nameById.get(owner) ?? "someone"}` : "Free"}
                          className={cn(
                            "flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-xs",
                            mine
                              ? "border-success/50 bg-success/15 text-success"
                              : owner
                                ? "text-muted-foreground"
                                : "border-primary/40 text-foreground",
                          )}
                        >
                          <span className={cn(owner && !mine && "line-through")}>{slotUtc(s)}</span>
                          {owner && !mine && (
                            <span className="max-w-24 truncate font-sans">{nameById.get(owner)}</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Green = their turn · outlined = free · crossed out = taken by someone else
                  </p>
                </div>
              )}
              </li>
            );
          })}
          {shown.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">
              {status === "excluded"
                ? `Nobody is excluded from ${DAYS[day].label}.`
                : rows.length === 0
                  ? `Nobody has signed up for ${DAYS[day].label} yet.`
                  : "No player matches these filters."}
            </li>
          )}
        </ol>
      </CardContent>
    </Card>
  );
}
