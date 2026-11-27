"use client";

import { useCallback, useState } from "react";
import { CalendarDays, CalendarOff, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ALLIANCES,
  ALLIANCE_STYLES,
  DAYS,
  TC_MAX_LEVEL,
  TC_MIN_LEVEL,
  tcLabelFull,
  DAY_KEYS,
  SLOTS_KEY,
  formatDuration,
  localTimeZone,
  useToday,
  type DayKey,
} from "@/lib/kvk";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useDayDate } from "./day-date";
import { DurationInput } from "./duration-input";
import { SlotGrid } from "./slot-grid";

export type Entry = {
  name: string;
  alliance: string;
  tcLevel: number;
  truegold: number;
  d1Construction: number;
  d1General: number;
  d2Research: number;
  d2General: number;
  d4Training: number;
  d4General: number;
  d1Slots: number[];
  d2Slots: number[];
  d4Slots: number[];
};

export const EMPTY_ENTRY: Entry = {
  name: "",
  alliance: "",
  tcLevel: 0,
  truegold: 0,
  d1Construction: 0,
  d1General: 0,
  d2Research: 0,
  d2General: 0,
  d4Training: 0,
  d4General: 0,
  d1Slots: [],
  d2Slots: [],
  d4Slots: [],
};

type SpeedupKey = "d1Construction" | "d1General" | "d2Research" | "d2General" | "d4Training" | "d4General";

export const SPEEDUP_FIELDS: Record<DayKey, SpeedupKey[]> = {
  d1: ["d1Construction", "d1General"],
  d2: ["d2Research", "d2General"],
  d4: ["d4Training", "d4General"],
};

// Copies only the entry fields, dropping anything else on the object (gameId, _creationTime).
export const toEntry = (e: Entry): Entry => ({
  name: e.name,
  alliance: e.alliance,
  tcLevel: e.tcLevel,
  truegold: e.truegold,
  d1Construction: e.d1Construction,
  d1General: e.d1General,
  d2Research: e.d2Research,
  d2General: e.d2General,
  d4Training: e.d4Training,
  d4General: e.d4General,
  d1Slots: e.d1Slots,
  d2Slots: e.d2Slots,
  d4Slots: e.d4Slots,
});

const sameSlots = (a: number[], b: number[]) => a.length === b.length && a.every((s, i) => s === b[i]);

// A field's new value, or a function from its latest value (so quick taps build on each other).
export type SetEntry = <K extends keyof Entry>(key: K, value: Entry[K] | ((prev: Entry[K]) => Entry[K])) => void;

// Form state for an entry. Every update reads the latest form, never a stale copy.
export function useEntryForm(initial: Entry | (() => Entry)) {
  const [form, setForm] = useState<Entry>(initial);
  const set: SetEntry = useCallback(
    (key, value) =>
      setForm((f) => ({ ...f, [key]: typeof value === "function" ? value(f[key]) : value })),
    [],
  );
  return [form, set, setForm] as const;
}

type FieldProps = {
  form: Entry;
  set: SetEntry;
};

// All the editable cards of an entry on one page. Used by the admin's edit screen;
// the player sign-up shows the same cards one step at a time.
export function EntryFields({ form, set, detailsTitle }: FieldProps & { detailsTitle: string }) {
  return (
    // One card per row; each day card puts its speedups beside its times on wide screens.
    <div className="flex flex-col gap-6">
      <DetailsCard form={form} set={set} step={1} title={detailsTitle} />
      {DAY_KEYS.map((day, i) => (
        <DayCard key={day} day={day} form={form} set={set} step={i + 2} />
      ))}
    </div>
  );
}

// With gameId, the card also asks for the game ID (player sign-up). Admins cannot change a game ID.
export function DetailsCard({
  form,
  set,
  step,
  title,
}: FieldProps & { step: number; title: string }) {
  const { t } = useLanguage();
  return (
    <Card>
      <CardHeader>
        <StepTitle step={step} title={title} />
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">{t("field.name")}</Label>
          <Input
            id="name"
            required
            maxLength={40}
            placeholder={t("field.namePlaceholder")}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label id="alliance-label">{t("field.alliance")}</Label>
          <div role="radiogroup" aria-labelledby="alliance-label" className="grid grid-cols-4 gap-2 xl:grid-cols-8">
            {ALLIANCES.map((tag) => {
              const on = form.alliance === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set("alliance", tag)}
                  className={cn(
                    "flex h-10 items-center justify-center gap-2 rounded-lg border font-mono text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    on ? ALLIANCE_STYLES[tag].tile : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className={cn("size-2 rounded-full", ALLIANCE_STYLES[tag].dot)} />
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Speedups and available times for one day.
// tcEditable is false at sign-up, where the Town Center level comes from the game.
// With onSkipChange, the player can say they don't need a turn that day (skipped hides the fields).
export function DayCard({
  day,
  form,
  set,
  step,
  tcEditable = true,
  skipped = false,
  onSkipChange,
}: FieldProps & {
  day: DayKey;
  step: number;
  tcEditable?: boolean;
  skipped?: boolean;
  onSkipChange?: (skipped: boolean) => void;
}) {
  const today = useToday();
  const { t } = useLanguage();
  const date = useDayDate()(day, true);
  const total = SPEEDUP_FIELDS[day].reduce((sum, key) => sum + form[key], 0);
  const slotsKey = SLOTS_KEY[day];
  // Later days can copy the times picked on an earlier day in one tap.
  // Days with the same times as an earlier day get one button, not two.
  const copyFrom = DAY_KEYS.slice(0, DAY_KEYS.indexOf(day)).filter(
    (d, i, days) =>
      form[SLOTS_KEY[d]].length > 0 &&
      !days.slice(0, i).some((e) => sameSlots(form[SLOTS_KEY[e]], form[SLOTS_KEY[d]])),
  );
  return (
    <Card className="@container/day">
      <CardHeader>
        <StepTitle step={step} title={`${t(`day.${day}`)} · ${t(`day.${day}.title`)}`} />
        <CardDescription className="flex flex-col gap-1 pl-10">
          {date && (
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <CalendarDays className="size-4 text-primary" />
              {date}
            </span>
          )}
          <span>
            {t("day.appointment")} <span className="font-medium text-foreground">{DAYS[day].position}</span>
          </span>
        </CardDescription>
      </CardHeader>
      {onSkipChange && (
        <CardContent className="-mt-2">
          {/* Sized to its text with the switch first, so it reads as one clear option. */}
          <label
            className={cn(
              "flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-base transition-colors sm:w-fit sm:pr-6",
              skipped
                ? "border-primary bg-primary/15 text-foreground"
                : "border-warning/50 bg-warning/10 hover:border-warning hover:bg-warning/15",
            )}
          >
            <Switch
              checked={skipped}
              onCheckedChange={(v) => onSkipChange(v)}
              className="scale-125 data-unchecked:bg-muted-foreground/40 dark:data-unchecked:bg-muted-foreground/40"
            />
            <CalendarOff className={cn("ml-1 size-5 shrink-0", skipped ? "text-primary" : "text-warning")} />
            <span className="font-semibold">{t("day.skip", { day: t(`day.${day}`) })}</span>
          </label>
        </CardContent>
      )}
      {skipped ? (
        <CardContent>
          <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            {t("day.skipped", { day: t(`day.${day}`) })}
          </p>
        </CardContent>
      ) : (
      // Wide cards: speedups on the left, times on the right.
      <CardContent className="grid gap-6 @4xl/day:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] @4xl/day:gap-8">
        <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5">
          {SPEEDUP_FIELDS[day].map((key) => (
            <DurationInput
              key={key}
              id={key}
              label={t(`speedup.${key}`)}
              value={form[key]}
              onChange={(minutes) => set(key, minutes)}
            />
          ))}
        </div>
        <div className="flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3">
          <span className="text-sm font-medium">{t("day.total", { day: t(`day.${day}`) })}</span>
          <span className="font-mono text-xl font-bold text-primary">{formatDuration(total)}</span>
        </div>
        {day === "d1" && <TownCenterFields form={form} set={set} tcEditable={tcEditable} />}
        </div>
        <Separator className="@4xl/day:hidden" />
        <div className="flex min-w-0 flex-col gap-6 @4xl/day:border-l @4xl/day:pl-8">
        <div className="flex flex-col gap-1">
          <p className="font-medium">
            {t("times.title")} <span className="text-primary">*</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {t("times.hint")}
            {today ? ` ${t("times.hintLocal", { tz: localTimeZone() })}` : ""}
          </p>
        </div>
        {copyFrom.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {copyFrom.map((d) => {
              const same = sameSlots(form[SLOTS_KEY[d]], form[slotsKey]);
              return (
                <Button
                  key={d}
                  type="button"
                  variant={same ? "secondary" : "default"}
                  disabled={same}
                  className="h-10"
                  onClick={() => set(slotsKey, [...form[SLOTS_KEY[d]]])}
                >
                  {same ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                  {t(same ? "times.sameAsDone" : "times.sameAs", { day: t(`day.${d}`) })}
                </Button>
              );
            })}
          </div>
        )}
        <SlotGrid value={form[slotsKey]} onChange={(update) => set(slotsKey, update)} />
        </div>
      </CardContent>
      )}
    </Card>
  );
}

// TC 26 to TG3, highest first.
const TC_ITEMS = Array.from({ length: TC_MAX_LEVEL - TC_MIN_LEVEL + 1 }, (_, i) => TC_MAX_LEVEL - i).map((level) => ({
  value: String(level),
  label: tcLabelFull(level),
}));

// Town Center level and the Truegold (TG) a player holds. Shown with the Day 1 speedups.
function TownCenterFields({ form, set, tcEditable }: FieldProps & { tcEditable: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="tc-level">
          {t("tc.level")} {tcEditable && <span className="text-primary">*</span>}
        </Label>
        {tcEditable ? (
          <Select
            items={TC_ITEMS}
            value={form.tcLevel ? String(form.tcLevel) : null}
            onValueChange={(v) => v && set("tcLevel", Number(v))}
          >
            <SelectTrigger id="tc-level" className="h-10! w-full">
              <SelectValue placeholder={t("tc.levelPlaceholder")} />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {TC_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div
            id="tc-level"
            className="flex h-10 items-center rounded-lg border bg-muted/50 px-3 font-mono text-sm text-muted-foreground"
          >
            {form.tcLevel ? tcLabelFull(form.tcLevel) : "—"}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="truegold">{t("tc.truegold")}</Label>
        <Input
          id="truegold"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="0"
          value={form.truegold || ""}
          onChange={(e) => set("truegold", Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className="h-10! font-mono"
        />
      </div>
    </div>
  );
}

function StepTitle({ step, title }: { step: number; title: string }) {
  return (
    <CardTitle className="flex items-center gap-3 text-base">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {step}
      </span>
      {title}
    </CardTitle>
  );
}
