"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { ArrowRight, Check, Lock, LockOpen, Sparkles, Trash2 } from "lucide-react";
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
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/client";
import {
  DAYS,
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
import { ConfirmButton } from "./confirm-button";

const EMPTY = "__empty";

export function AdminDay({ password, day, data }: { password: string; day: DayKey; data: Dashboard }) {
  const autoAssign = useMutation(api.kvk.admin.autoAssign);
  const setTurn = useMutation(api.kvk.admin.setTurn);
  const setLocked = useMutation(api.kvk.admin.setLocked);
  const clearDay = useMutation(api.kvk.admin.clearDay);
  const [assigning, setAssigning] = useState(false);
  const [previewing, setPreviewing] = useState(false);
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

  // Labels the closed dropdown shows for the selected value.
  const options = useMemo(
    () => [{ value: EMPTY, label: "— Empty —" }, ...sorted.map((p) => ({ value: p.gameId, label: playerLabel(p) }))],
    [sorted],
  );

  // One dropdown row: name, speedups for this day, and the turn they already hold (picking them moves them).
  const optionItem = (p: (typeof sorted)[number], slot: number) => {
    const held = turnOf.get(p.gameId);
    return (
      <SelectItem key={p.gameId} value={p.gameId}>
        <span className="truncate">{playerLabel(p)}</span>
        <span className="font-mono text-xs text-muted-foreground">{formatDuration(dayScore(p, day))}</span>
        {held !== undefined && held !== slot && (
          <span className="text-xs text-warning">has {slotUtc(held)}</span>
        )}
      </SelectItem>
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

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {plan.changes.length > 0 ? (
          <Button className="col-span-2 h-10 sm:col-span-1" onClick={() => setPreviewing(true)}>
            <Sparkles data-icon="inline-start" />
            Auto-assign · {plan.changes.length} {plan.changes.length === 1 ? "change" : "changes"}
          </Button>
        ) : (
          <Button variant="outline" className="col-span-2 h-10 sm:col-span-1" disabled>
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
                  {nameOf(from) ?? "Empty"}
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                <span className={cn("min-w-0 flex-1 truncate", to ? "font-medium text-primary" : "text-muted-foreground")}>
                  {nameOf(to) ?? "Empty"}
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
          <CardDescription>
            Each dropdown lists the players who picked that time first, most {DAYS[day].label} speedups on top.
            Picking a player by hand locks the turn and moves them off any other turn this day. Auto-assign keeps
            locked turns.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time (UTC)</TableHead>
                <TableHead className="w-full min-w-36">Player</TableHead>
                <TableHead className="hidden sm:table-cell">Speedups</TableHead>
                <TableHead className="w-12">Lock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SLOTS.map((slot) => {
                const turn = bySlot.get(slot);
                const player = turn && byId.get(turn.gameId);
                const picked = pickedBy.get(slot) ?? [];
                const pickedIds = new Set(picked.map((p) => p.gameId));
                const others = sorted.filter((p) => !pickedIds.has(p.gameId));
                return (
                  <TableRow key={slot} className={cn(turn?.locked && "bg-primary/5")}>
                    <TableCell>
                      <div className="font-mono font-semibold">{slotRangeUtc(slot)}</div>
                      {today && <div className="text-xs text-muted-foreground">{formatSlotLocal(slot, today)}</div>}
                      <div className={cn("text-xs", picked.length > 0 ? "text-primary" : "text-muted-foreground")}>
                        {picked.length} picked
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        items={options}
                        value={turn?.gameId ?? EMPTY}
                        onValueChange={(v) =>
                          run(() => setTurn({ password, day, slot, gameId: !v || v === EMPTY ? null : v }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectItem value={EMPTY}>— Empty —</SelectItem>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel>
                              {picked.length > 0 ? `Picked this time (${picked.length})` : "Nobody picked this time"}
                            </SelectLabel>
                            {picked.map((p) => optionItem(p, slot))}
                          </SelectGroup>
                          {others.length > 0 && (
                            <>
                              <SelectSeparator />
                              <SelectGroup>
                                <SelectLabel>Didn&apos;t pick this time</SelectLabel>
                                {others.map((p) => optionItem(p, slot))}
                              </SelectGroup>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{player ? formatDuration(dayScore(player, day)) : "—"}</TableCell>
                    <TableCell>
                      {turn && (
                        <Button
                          variant={turn.locked ? "default" : "ghost"}
                          size="icon-sm"
                          aria-label={turn.locked ? "Unlock turn" : "Lock turn"}
                          onClick={() => run(() => setLocked({ password, day, slot, locked: !turn.locked }))}
                        >
                          {turn.locked ? <Lock /> : <LockOpen className="text-muted-foreground" />}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ranking</CardTitle>
          <CardDescription>
            Players with speedups and at least one picked time, most speedups first. Ties go to who signed up first.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Speedups</TableHead>
                <TableHead>Times picked</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranked.map((r, i) => {
                const slot = turnOf.get(r.player.gameId);
                return (
                  <TableRow key={r.player.gameId}>
                    <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>{playerLabel(r.player)}</TableCell>
                    <TableCell>{formatDuration(r.score)}</TableCell>
                    <TableCell>{r.slots.length}</TableCell>
                    <TableCell>
                      {slot !== undefined ? (
                        <Badge variant="success">Has turn · {slotUtc(slot)}</Badge>
                      ) : (
                        <Badge variant="warning">Waiting</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {ranked.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nobody has signed up for {DAYS[day].label} yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
