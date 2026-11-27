"use client";

import { api } from "@convex/_generated/api";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import { ArrowLeft, ArrowRight, CalendarClock, CircleAlert, CircleCheck, Lock, LogOut, Search, TriangleAlert } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
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
import { errorMessage, storage, useStoredString } from "@/lib/client";
import {
  ALLIANCES,
  DAYS,
  SLOTS_KEY,
  MIN_SLOTS,
  DAY_KEYS,
  dayScoreOf,
  formatDuration,
  formatTruegold,
  formatSlotLocal,
  playerLabel,
  slotRangeUtc,
  KINGDOM_ID,
  slotUtc,
  tcLabel,
  useToday,
  type DayKey,
} from "@/lib/kvk";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PlayerName } from "./alliance-tag";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDayDate } from "./day-date";
import { DayCard, EMPTY_ENTRY, SPEEDUP_FIELDS, useEntryForm, type Entry } from "./entry-form";

export function KvkSignup() {
  const settings = useQuery(api.kvk.schedule.settings);
  // The game ID this browser signed up with (or looked up), so the entry and turn show on return visits.
  const [gameId, setGameId] = useStoredString("kvk:gameId");
  const entry = useQuery(api.kvk.players.get, gameId ? { gameId } : "skip");
  const loading = gameId === undefined || (!!gameId && entry === undefined);
  const { t } = useLanguage();

  return (
    <>
      <PageHeader
        eyebrow={settings?.eventName ?? "KvK"}
        title={t("signup.title")}
        description={t("signup.desc")}
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
  const { t } = useLanguage();

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
              <span className="text-success"> · {t("signup.signedUp")}</span>
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onSwitch}>
            <LogOut data-icon="inline-start" />
            {t("signup.notYou")}
          </Button>
        </CardContent>
      </Card>

      {turns && <MyTurns turns={turns} entry={entry} />}

      <Notice icon={Lock} title={t("final.title")}>
        {t("final.body")}
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
function EntrySummary({ entry, title, description }: { entry: Entry; title?: string; description?: string }) {
  const { t } = useLanguage();
  const dateOf = useDayDate();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title ?? t("entry.title")}</CardTitle>
        <CardDescription>{description ?? t("entry.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        {DAY_KEYS.map((day) => {
          const slots = entry[SLOTS_KEY[day]];
          return (
            <div key={day} className="flex flex-col gap-3 rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {t(`day.${day}`)}
                {dateOf(day) && ` · ${dateOf(day)}`} · {t(`day.${day}.title`)}
              </p>
              {slots.length === 0 ? (
                <p className="py-4 text-center text-sm font-medium text-muted-foreground">{t("entry.skipped")}</p>
              ) : (
              <>
              <dl className="flex flex-col gap-1 text-sm">
                {day === "d1" && (
                  <>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{t("entry.tc")}</dt>
                      <dd className="font-mono">{entry.tcLevel ? tcLabel(entry.tcLevel) : "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{t("entry.truegold")}</dt>
                      <dd className="font-mono">{formatTruegold(entry.truegold)}</dd>
                    </div>
                  </>
                )}
                {SPEEDUP_FIELDS[day].map((key) => (
                  <div key={key} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{t(`speedup.${key}`)}</dt>
                    <dd className="font-mono">{formatDuration(entry[key])}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t pt-1 font-semibold">
                  <dt>{t("entry.total")}</dt>
                  <dd className="font-mono text-primary">{formatDuration(dayScoreOf(entry, day))}</dd>
                </div>
              </dl>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-muted-foreground">
                  {slots.length > 0 ? t("entry.timesPicked", { n: slots.length }) : t("entry.noTimes")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {slots.map((s) => (
                    <Badge key={s} variant="secondary" className="font-mono">
                      {slotUtc(s)}
                    </Badge>
                  ))}
                </div>
              </div>
              </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function MyTurns({ turns, entry }: { turns: { day: DayKey; slot: number }[]; entry: Entry }) {
  const today = useToday();
  const { t } = useLanguage();
  const dateOf = useDayDate();
  return (
    <Card className="ring-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-5 text-primary" />
          {t("turns.title")}
        </CardTitle>
        <CardDescription>{t("turns.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {DAY_KEYS.map((day) => {
          const mine = turns.filter((turn) => turn.day === day);
          const signedUp = entry[SLOTS_KEY[day]].length > 0;
          return (
            <div key={day} className="flex flex-col gap-1 rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {t(`day.${day}`)}
                {dateOf(day) && ` · ${dateOf(day)}`} · {DAYS[day].position}
              </p>
              {mine.length > 0 ? (
                mine.map((turn) => (
                  <div key={turn.slot}>
                    <p className="font-mono text-xl font-bold text-primary">{slotRangeUtc(turn.slot)}</p>
                    <p className="text-xs text-muted-foreground">
                      UTC{today && ` · ${formatSlotLocal(turn.slot, today)} ${t("turns.yourTime")}`}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm">
                  {signedUp ? t("turns.waitlist") : t("turns.noTimes")}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// First and only submission, one section at a time: details (with game ID), each day, review.
// Asks for confirmation at the end because the entry cannot be edited afterwards.
// The unfinished sign-up is saved in this browser as the player goes, so a reload
// (or a crash) brings them back to the same step with everything they entered.
const DRAFT_KEY = "kvk:signupDraft";
type Draft = {
  rawGameId: string;
  lookup: { id: string; result: LookupResult } | null;
  form: Entry;
  skipped: DayKey[];
  step: number;
};
function readDraft(): Draft | null {
  try {
    const raw = storage.get(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    // Ignore drafts from an older version of the form (different fields).
    if (!d.form || !Object.keys(EMPTY_ENTRY).every((k) => k in d.form!)) return null;
    return {
      rawGameId: typeof d.rawGameId === "string" ? d.rawGameId : "",
      lookup: d.lookup ?? null,
      form: d.form,
      skipped: Array.isArray(d.skipped) ? d.skipped.filter((x) => DAY_KEYS.includes(x)) : [],
      step: typeof d.step === "number" && d.step >= 0 && d.step <= DAY_KEYS.length + 1 ? d.step : 0,
    };
  } catch {
    return null;
  }
}

function SignupForm({ onSignedUp }: { onSignedUp: (gameId: string) => void }) {
  const convex = useConvex();
  const save = useMutation(api.kvk.players.save);
  const lookupPlayer = useAction(api.kvk.lookup.player);
  // Only rendered in the browser (never on the server), so reading the draft here is safe.
  const [draft] = useState(readDraft);
  const [rawGameId, setRawGameId] = useState(draft?.rawGameId ?? "");
  // Result of checking the game ID, and the ID it was for (typing a new ID clears it).
  const [lookup, setLookup] = useState<{ id: string; result: LookupResult } | null>(draft?.lookup ?? null);
  const [form, set, setForm] = useEntryForm(draft?.form ?? EMPTY_ENTRY);
  // Days the player said they don't need a turn on. Their speedups and times are cleared.
  const [skipped, setSkipped] = useState<DayKey[]>(draft?.skipped ?? []);
  const setSkip = (day: DayKey, skip: boolean) => {
    setSkipped((s) => (skip ? [...s, day] : s.filter((d) => d !== day)));
    if (skip)
      setForm((f) => ({
        ...f,
        [SLOTS_KEY[day]]: [],
        ...Object.fromEntries(SPEEDUP_FIELDS[day].map((key) => [key, 0])),
      }));
  };
  const [step, setStep] = useState(draft?.step ?? 0);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    storage.set(DRAFT_KEY, JSON.stringify({ rawGameId, lookup, form, skipped, step } satisfies Draft));
  }, [rawGameId, lookup, form, skipped, step]);
  const [saving, setSaving] = useState(false);
  const { t } = useLanguage();
  const steps = [t("step.details"), ...DAY_KEYS.map((d) => t(`day.${d}`)), t("step.review")];
  const gameId = rawGameId.trim();
  const last = steps.length - 1;

  const go = (next: number) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  // Leaving the details step: a game ID that already signed up goes straight to its (final) entry.
  const next = async () => {
    if (step > 0) {
      const day = DAY_KEYS[step - 1];
      const picked = form[SLOTS_KEY[day]];
      if (!skipped.includes(day) && picked.length < MIN_SLOTS)
        return void toast.error(t("toast.pickTime", { day: t(`day.${day}`) }));
      if (step === DAY_KEYS.length && skipped.length === DAY_KEYS.length) return void toast.error(t("toast.allSkipped"));
      return go(step + 1);
    }
    // Step 1: the game ID must be found in the game, in our kingdom and alliances.
    if (lookup?.id === gameId && lookup.result.status === "ok") return go(1);
    if (!/^\d{3,15}$/.test(gameId)) return void toast.error(t("lookup.badId"));
    await checkId(gameId);
  };

  // Looks a game ID up in the game. Also used when the player picks their name from the search.
  const checkId = async (id: string) => {
    setSaving(true);
    try {
      if (await convex.query(api.kvk.players.get, { gameId: id })) {
        toast.info(t("toast.alreadySignedUp"));
        storage.set(DRAFT_KEY, null);
        return onSignedUp(id);
      }
      const result = await lookupPlayer({ gameId: id });
      setLookup({ id, result });
      if (result.status === "ok")
        setForm((f) => ({ ...f, name: result.name ?? "", alliance: result.alliance ?? "", tcLevel: result.tcLevel ?? 0 }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const verified = lookup?.id === gameId && lookup.result.status === "ok";

  const submit = async () => {
    setSaving(true);
    try {
      const { name: _name, alliance: _alliance, tcLevel: _tcLevel, ...rest } = form;
      await save({ gameId, ...rest });
      toast.success(t("toast.signedUp"));
      storage.set(DRAFT_KEY, null);
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
      <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((label, i) => (
          <li key={i} aria-current={i === step ? "step" : undefined}>
            <button
              type="button"
              disabled={i >= step}
              onClick={() => go(i)}
              className="flex w-full flex-col gap-1.5 text-left disabled:cursor-default"
            >
              <span className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
              <span
                className={cn("truncate text-xs font-medium", i === step ? "text-foreground" : "text-muted-foreground")}
              >
                {i + 1}. {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <IdCheck
          value={rawGameId}
          onChange={setRawGameId}
          onPick={(id) => {
            setRawGameId(id);
            void checkId(id);
          }}
          result={lookup?.id === gameId ? lookup.result : null}
          checking={saving}
        />
      )}
      {DAY_KEYS.map(
        (day, i) =>
          step === i + 1 && (
            <DayCard
              key={day}
              day={day}
              form={form}
              set={set}
              step={i + 2}
              tcEditable={false}
              skipped={skipped.includes(day)}
              onSkipChange={(skip) => setSkip(day, skip)}
            />
          ),
      )}
      {step === last && (
        <EntrySummary
          entry={form}
          title={t("review.title")}
          description={t("review.desc", {
            name: playerLabel({ name: form.name.trim(), alliance: form.alliance.trim() }),
            id: gameId,
          })}
        />
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        {step === last && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
            <TriangleAlert className="size-3.5 shrink-0" />
            {t("final.line")}
          </p>
        )}
        <div className="flex gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" className="h-12 px-5 text-base" onClick={() => go(step - 1)}>
              <ArrowLeft data-icon="inline-start" />
              {t("step.back")}
            </Button>
          )}
          <Button type="submit" className="h-12 flex-1 text-base sm:flex-none sm:px-8" disabled={saving}>
            {step === last
              ? t("action.signUp")
              : step === 0 && !verified
                ? saving
                  ? t("lookup.checking")
                  : t("lookup.check")
                : t("step.next", { step: steps[step + 1] })}
            {step < last && (step > 0 || verified) && <ArrowRight data-icon="inline-end" />}
            {step === 0 && !verified && <Search data-icon="inline-end" />}
          </Button>
        </div>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirm.desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirm.back")}</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={submit}>
              {saving ? t("action.saving") : t("confirm.submit")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

type LookupResult = {
  status: "ok" | "not_found" | "wrong_kingdom" | "wrong_alliance" | "pending" | "error";
  name?: string;
  alliance?: string;
  tcLevel?: number;
  kid?: number;
};

// Step 1: the player types only their game ID. Name, alliance and Town Center level come from the game.
// The game ID field. Typing a name instead searches our alliances' members, so players who
// don't know their ID can tap their name.
function IdCheck({
  value,
  onChange,
  onPick,
  result,
  checking,
}: {
  value: string;
  onChange: (value: string) => void;
  onPick: (gameId: string) => void;
  result: LookupResult | null;
  checking: boolean;
}) {
  const { t } = useLanguage();
  const text = value.trim();
  const isName = text.length >= 2 && !/^\d+$/.test(text);
  const matches = useQuery(api.kvk.lookup.searchMembers, isName ? { query: text } : "skip");
  const problem =
    result && result.status !== "ok"
      ? {
          not_found: t("lookup.notFound"),
          wrong_kingdom: t("lookup.wrongKingdom", { kid: result.kid ?? "?", ours: KINGDOM_ID }),
          wrong_alliance: t("lookup.wrongAlliance", { alliance: result.alliance || "—", alliances: ALLIANCES.join(", ") }),
          pending: t("lookup.pending"),
          error: t("lookup.error"),
        }[result.status]
      : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-base">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            1
          </span>
          {t("details.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="game-id">{t("field.gameId")}</Label>
          <Input
            id="game-id"
            required
            maxLength={40}
            autoComplete="off"
            placeholder={t("field.gameIdPlaceholder")}
            value={value}
            disabled={checking}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 text-base"
          />
        </div>
        {isName && matches !== undefined && (
          <div className="flex flex-col gap-2">
            {matches.length > 0 ? (
              <>
                <p className="text-xs text-muted-foreground">{t("lookup.tapYou")}</p>
                <ul className="flex flex-col divide-y rounded-lg border">
                  {matches.map((m) => (
                    <li key={m.gameId}>
                      <button
                        type="button"
                        disabled={checking}
                        onClick={() => onPick(m.gameId)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 disabled:opacity-50"
                      >
                        <span className="flex min-w-0 flex-1 flex-col">
                          <PlayerName player={m} className="max-w-full font-medium" />
                          <span className="font-mono text-xs text-muted-foreground">ID {m.gameId}</span>
                        </span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {m.tcLevel ? tcLabel(m.tcLevel) : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("lookup.noNameMatch")}</p>
            )}
          </div>
        )}
        {result?.status === "ok" && (
          <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/10 p-3">
            <CircleCheck className="size-5 shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{t("lookup.found")}</p>
              <PlayerName player={{ name: result.name ?? "", alliance: result.alliance ?? "" }} className="max-w-full font-semibold" />
            </div>
            <span className="shrink-0 rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold">
              {result.tcLevel ? tcLabel(result.tcLevel) : "—"}
            </span>
          </div>
        )}
        {problem && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p>{problem}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
