"use client";

import { api } from "@convex/_generated/api";
import { useConvex, useMutation, useQuery } from "convex/react";
import { ArrowLeft, ArrowRight, CalendarClock, Lock, LogOut, TriangleAlert } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
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
import { errorMessage, useStoredString } from "@/lib/client";
import {
  DAYS,
  DAY_KEYS,
  dayScoreOf,
  formatDuration,
  formatSlotLocal,
  playerLabel,
  slotRangeUtc,
  slotUtc,
  useToday,
  type DayKey,
} from "@/lib/kvk";
import { cn } from "@/lib/utils";
import { PlayerName } from "./alliance-tag";
import { DayCard, DetailsCard, EMPTY_ENTRY, SPEEDUP_FIELDS, type Entry } from "./entry-form";

export function KvkSignup() {
  const settings = useQuery(api.kvk.schedule.settings);
  // The game ID this browser signed up with (or looked up), so the entry and turn show on return visits.
  const [gameId, setGameId] = useStoredString("kvk:gameId");
  const entry = useQuery(api.kvk.players.get, gameId ? { gameId } : "skip");
  const loading = gameId === undefined || (!!gameId && entry === undefined);

  return (
    <>
      <PageHeader
        eyebrow={settings?.eventName ?? "KvK"}
        title="Appointment sign-up"
        description="Enter your speedups and the times you can play. The most speedups get turns first. You can only submit once — entries can't be edited afterwards."
      />
      {loading ? null : gameId && entry ? (
        <PlayerArea gameId={gameId} entry={entry} onSwitch={() => setGameId(null)} />
      ) : (
        <SignupForm onSignedUp={setGameId} />
      )}
    </>
  );
}

function PlayerArea({ gameId, entry, onSwitch }: { gameId: string; entry: Entry; onSwitch: () => void }) {
  const turns = useQuery(api.kvk.players.myTurns, { gameId });

  return (
    <>
      <Card size="sm">
        <CardContent className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {entry.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex font-semibold">
              <PlayerName player={entry} />
            </p>
            <p className="text-xs text-muted-foreground">
              ID <span className="font-mono">{gameId}</span>
              <span className="text-success"> · Signed up</span>
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onSwitch}>
            <LogOut data-icon="inline-start" />
            Not you?
          </Button>
        </CardContent>
      </Card>

      {turns && <MyTurns turns={turns} entry={entry} />}

      <Notice icon={Lock} title="Your entry is final">
        Entries can&apos;t be edited after signing up. If something is wrong, ask your King or R4 — only an admin can
        change it.
      </Notice>
      <EntrySummary entry={entry} />
    </>
  );
}

function Notice({ icon: Icon, title, children }: { icon: typeof Lock; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-warning" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

// Read-only view of what the player submitted.
function EntrySummary({
  entry,
  title = "Your entry",
  description = "What you submitted. Read-only.",
}: {
  entry: Entry;
  title?: string;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {DAY_KEYS.map((day) => {
          const slots = day === "d1" ? entry.d1Slots : entry.d4Slots;
          return (
            <div key={day} className="flex flex-col gap-3 rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {DAYS[day].label} · {DAYS[day].title}
              </p>
              <dl className="flex flex-col gap-1 text-sm">
                {SPEEDUP_FIELDS[day].map((f) => (
                  <div key={f.key} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="font-mono">{formatDuration(entry[f.key])}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t pt-1 font-semibold">
                  <dt>Total</dt>
                  <dd className="font-mono text-primary">{formatDuration(dayScoreOf(entry, day))}</dd>
                </div>
              </dl>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-muted-foreground">
                  {slots.length > 0 ? `${slots.length} times picked (UTC)` : "No times picked"}
                </p>
                <div className="flex flex-wrap gap-1">
                  {slots.map((s) => (
                    <Badge key={s} variant="secondary" className="font-mono">
                      {slotUtc(s)}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function MyTurns({ turns, entry }: { turns: { day: DayKey; slot: number }[]; entry: Entry }) {
  const today = useToday();
  return (
    <Card className="ring-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-5 text-primary" />
          Your turns
        </CardTitle>
        <CardDescription>The schedule is out. Be online at the start of your turn.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {DAY_KEYS.map((day) => {
          const mine = turns.filter((t) => t.day === day);
          const signedUp = (day === "d1" ? entry.d1Slots : entry.d4Slots).length > 0;
          return (
            <div key={day} className="flex flex-col gap-1 rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {DAYS[day].label} · {DAYS[day].position}
              </p>
              {mine.length > 0 ? (
                mine.map((t) => (
                  <div key={t.slot}>
                    <p className="font-mono text-xl font-bold text-primary">{slotRangeUtc(t.slot)}</p>
                    <p className="text-xs text-muted-foreground">
                      UTC{today && ` · ${formatSlotLocal(t.slot, today)} your time`}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm">
                  {signedUp ? "No turn yet — you're on the waitlist." : "You didn't pick any times for this day."}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

const STEPS = ["Details", ...DAY_KEYS.map((d) => DAYS[d].label), "Review"];

// First and only submission, one section at a time: details (with game ID), Day 1, Day 4, review.
// Asks for confirmation at the end because the entry cannot be edited afterwards.
function SignupForm({ onSignedUp }: { onSignedUp: (gameId: string) => void }) {
  const convex = useConvex();
  const save = useMutation(api.kvk.players.save);
  const [rawGameId, setRawGameId] = useState("");
  const [form, setForm] = useState<Entry>(EMPTY_ENTRY);
  const [step, setStep] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Entry>(key: K, value: Entry[K]) => setForm((f) => ({ ...f, [key]: value }));
  const gameId = rawGameId.trim();
  const last = STEPS.length - 1;

  const go = (next: number) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  // Leaving the details step: a game ID that already signed up goes straight to its (final) entry.
  const next = async () => {
    if (step > 0) return go(step + 1);
    if (!form.alliance) return void toast.error("Pick your alliance.");
    setSaving(true);
    try {
      if (await convex.query(api.kvk.players.get, { gameId })) {
        toast.info("This game ID is already signed up. Entries can't be edited.");
        onSignedUp(gameId);
      } else go(1);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await save({ gameId, ...form });
      toast.success("You're signed up");
      onSignedUp(gameId);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  };

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (step < last) next();
        else setConfirming(true);
      }}
      className="flex flex-col gap-6"
    >
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined}>
            <button
              type="button"
              disabled={i >= step}
              onClick={() => go(i)}
              className="flex w-full flex-col gap-1.5 text-left disabled:cursor-default"
            >
              <span className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
              <span className={cn("text-xs font-medium", i === step ? "text-foreground" : "text-muted-foreground")}>
                {i + 1}. {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <DetailsCard
          form={form}
          set={set}
          step={1}
          title="Your details"
          gameId={{ value: rawGameId, onChange: setRawGameId }}
        />
      )}
      {DAY_KEYS.map((day, i) => step === i + 1 && <DayCard key={day} day={day} form={form} set={set} step={i + 2} />)}
      {step === last && (
        <EntrySummary
          entry={form}
          title="Review your entry"
          description={`Signing up as ${playerLabel({ name: form.name.trim(), alliance: form.alliance.trim() })} · ID ${gameId}. Go back to fix anything now — you can't after you submit.`}
        />
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        {step === last && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
            <TriangleAlert className="size-3.5 shrink-0" />
            Final — you can&apos;t edit after signing up.
          </p>
        )}
        <div className="flex gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" className="h-12 px-5 text-base" onClick={() => go(step - 1)}>
              <ArrowLeft data-icon="inline-start" />
              Back
            </Button>
          )}
          <Button type="submit" className="h-12 flex-1 text-base sm:flex-none sm:px-8" disabled={saving}>
            {step === last ? "Sign up" : `Next: ${STEPS[step + 1]}`}
            {step < last && <ArrowRight data-icon="inline-end" />}
          </Button>
        </div>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your entry? This is final.</AlertDialogTitle>
            <AlertDialogDescription>
              You won&apos;t be able to edit it afterwards. Only an admin (your King or R4) can change it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back and check</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={submit}>
              {saving ? "Saving…" : "Submit — final"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
