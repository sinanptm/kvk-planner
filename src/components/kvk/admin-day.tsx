"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { ArrowRight, Check, Lock, LockOpen, Sparkles, Trash2, UserCheck, Users } from "lucide-react";
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
  assignDay,
  dayScore,
  formatDuration,
  formatSlotLocal,
  playerLabel,
  rankPlayers,
  slotRangeUtc,
  slotUtc,
  useToday,
  type DayKey,
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
    () => [...players].sort((a, b) => dayScore(b, day) - dayScore(a, day) || a._creationTime - b._creationTime),
    [players, day],
  );

  // For each turn, the players who picked that time, in the order above.
  const pickedBy = useMemo(() => {
    const map = new Map<number, typeof sorted>(SLOTS.map((slot) => [slot, []]));
    for (const p of sorted) for (const slot of day === "d1" ? p.d1Slots : p.d4Slots) map.get(slot)?.push(p);
    return map;
  }, [sorted, day]);

  // One dropdown row: name on the left, speedups for this day on the right.
  // Players who already hold another turn are dimmed and show where they would move from.
  const optionItem = (p: (typeof sorted)[number]) => {
    const held = turnOf.get(p.gameId);
    return (
      <SelectItem key={p.gameId} value={p.gameId}>
        <PlayerName player={p} className={cn("flex-1", held !== undefined && "opacity-60")} />
        {held !== undefined && (
          <span className="rounded bg-muted px-1.5 text-[11px] text-muted-foreground">at {slotUtc(held)}</span>
        )}
        <span className="w-14 text-right font-mono text-xs text-muted-foreground tabular-nums">
          {shortDuration(dayScore(p, day))}
        </span>
      </SelectItem>
    );
  };

  // The dropdown for one turn: free players who picked the time, then ones already placed elsewhere,
  // and (only when the switch is on) everyone who did not pick it.
  const optionGroups = (slot: number) => {
    const current = bySlot.get(slot)?.gameId;
    const isFree = (p: (typeof sorted)[number]) => !turnOf.has(p.gameId) || p.gameId === current;
    const picked = pickedBy.get(slot) ?? [];
    const pickedIds = new Set(picked.map((p) => p.gameId));
    const groups = [
      { label: "Picked this time", players: picked.filter(isFree) },
      { label: "Picked this time · already has a turn", players: picked.filter((p) => !isFree(p)) },
      { label: "Didn\u2019t pick this time", players: showAll ? sorted.filter((p) => !pickedIds.has(p.gameId)) : [] },
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
            {g.players.map(optionItem)}
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
    return { changes, filled: next.length, waitlist };
  }, [players, day, bySlot]);

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
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">
          {DAYS[day].label} · {DAYS[day].title}
        </h2>
        <p className="text-sm text-muted-foreground">
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

      <AlertDialog open={previewing} onOpenChange={setPreviewing}>
        <AlertDialogContent className="data-[size=default]:sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Auto-assign {DAYS[day].label}: {plan.changes.length} {plan.changes.length === 1 ? "change" : "changes"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Nothing is saved until you apply. After this, {plan.filled}/{SLOTS.length} turns are filled and{" "}
              {plan.waitlist.length} {plan.waitlist.length === 1 ? "player is" : "players are"} on the waitlist. Locked
              turns stay as they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="flex max-h-72 flex-col divide-y overflow-y-auto rounded-lg border text-sm">
            {plan.changes.map(({ slot, from, to }) => (
              <li key={slot} className="flex items-center gap-2 px-3 py-2">
                <span className="w-12 shrink-0 font-mono font-semibold">{slotUtc(slot)}</span>
                <span className={cn("min-w-0 flex-1 truncate", from ? "line-through opacity-60" : "text-muted-foreground")}>
                  {playerNode(from) ?? "Empty"}
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                <span className={cn("min-w-0 flex-1 truncate", to ? "font-medium text-primary" : "text-muted-foreground")}>
                  {playerNode(to) ?? "Empty"}
                </span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={assigning} onClick={runAutoAssign}>
              {assigning ? "Assigning…" : "Apply changes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {period.slots.map((slot) => {
                  const turn = bySlot.get(slot);
                  const player = turn && byId.get(turn.gameId);
                  const picked = pickedBy.get(slot) ?? [];
                  return (
                    <div key={slot} className="relative">
                      <Select
                        value={turn?.gameId ?? EMPTY}
                        onValueChange={(v) =>
                          run(() => setTurn({ password, day, slot, gameId: !v || v === EMPTY ? null : v }))
                        }
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
                            {player ? formatDuration(dayScore(player, day)) : turn ? "—" : `${picked.length} picked`}
                          </div>
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false} align="start" className="min-w-72!">
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

      <Card>
        <CardHeader>
          <CardTitle>Ranking</CardTitle>
          <CardDescription>
            Players with speedups and at least one picked time, most speedups first. Ties go to who signed up first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col divide-y">
            {ranked.map((r, i) => {
              const slot = turnOf.get(r.player.gameId);
              return (
                <li key={r.player.gameId} className="flex items-center gap-3 py-2.5">
                  <span className="w-6 shrink-0 font-mono text-sm text-muted-foreground">{i + 1}</span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <PlayerName player={r.player} className="max-w-full font-medium" />
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(r.score)} · {r.slots.length} {r.slots.length === 1 ? "time" : "times"} picked
                    </span>
                  </div>
                  {slot !== undefined ? (
                    <Badge variant="success">Turn {slotUtc(slot)}</Badge>
                  ) : (
                    <Badge variant="warning">Waiting</Badge>
                  )}
                </li>
              );
            })}
            {ranked.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                Nobody has signed up for {DAYS[day].label} yet.
              </li>
            )}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
