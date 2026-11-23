"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ALLIANCES,
  ALLIANCE_STYLES,
  DAYS,
  DAY_KEYS,
  formatDuration,
  localTimeZone,
  useToday,
  type DayKey,
} from "@/lib/kvk";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DurationInput } from "./duration-input";
import { SlotGrid } from "./slot-grid";

export type Entry = {
  name: string;
  alliance: string;
  d1Construction: number;
  d1Research: number;
  d1General: number;
  d4Training: number;
  d4General: number;
  d1Slots: number[];
  d4Slots: number[];
};

export const EMPTY_ENTRY: Entry = {
  name: "",
  alliance: "",
  d1Construction: 0,
  d1Research: 0,
  d1General: 0,
  d4Training: 0,
  d4General: 0,
  d1Slots: [],
  d4Slots: [],
};

type SpeedupKey = "d1Construction" | "d1Research" | "d1General" | "d4Training" | "d4General";

export const SPEEDUP_FIELDS: Record<DayKey, SpeedupKey[]> = {
  d1: ["d1Construction", "d1Research", "d1General"],
  d4: ["d4Training", "d4General"],
};

// Copies only the entry fields, dropping anything else on the object (gameId, _creationTime).
export const toEntry = (e: Entry): Entry => ({
  name: e.name,
  alliance: e.alliance,
  d1Construction: e.d1Construction,
  d1Research: e.d1Research,
  d1General: e.d1General,
  d4Training: e.d4Training,
  d4General: e.d4General,
  d1Slots: e.d1Slots,
  d4Slots: e.d4Slots,
});

type FieldProps = {
  form: Entry;
  set: <K extends keyof Entry>(key: K, value: Entry[K]) => void;
};

// All the editable cards of an entry on one page. Used by the admin's edit screen;
// the player sign-up shows the same cards one step at a time.
export function EntryFields({ form, set, detailsTitle }: FieldProps & { detailsTitle: string }) {
  return (
    <>
      <DetailsCard form={form} set={set} step={1} title={detailsTitle} />
      {DAY_KEYS.map((day, i) => (
        <DayCard key={day} day={day} form={form} set={set} step={i + 2} />
      ))}
    </>
  );
}

// With gameId, the card also asks for the game ID (player sign-up). Admins cannot change a game ID.
export function DetailsCard({
  form,
  set,
  step,
  title,
  gameId,
}: FieldProps & { step: number; title: string; gameId?: { value: string; onChange: (value: string) => void } }) {
  const { t } = useLanguage();
  return (
    <Card>
      <CardHeader>
        <StepTitle step={step} title={title} />
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {gameId && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="game-id">{t("field.gameId")}</Label>
            <Input
              id="game-id"
              required
              maxLength={32}
              inputMode="numeric"
              autoComplete="off"
              placeholder={t("field.gameIdPlaceholder")}
              value={gameId.value}
              onChange={(e) => gameId.onChange(e.target.value)}
              className="h-10 font-mono"
            />
          </div>
        )}
        <div className={cn("flex flex-col gap-2", !gameId && "sm:col-span-2")}>
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
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label id="alliance-label">{t("field.alliance")}</Label>
          <div role="radiogroup" aria-labelledby="alliance-label" className="grid grid-cols-4 gap-2">
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
export function DayCard({ day, form, set, step }: FieldProps & { day: DayKey; step: number }) {
  const today = useToday();
  const { t } = useLanguage();
  const total = SPEEDUP_FIELDS[day].reduce((sum, key) => sum + form[key], 0);
  const slotsKey = day === "d1" ? "d1Slots" : "d4Slots";
  return (
    <Card>
      <CardHeader>
        <StepTitle step={step} title={`${t(`day.${day}`)} · ${t(`day.${day}.title`)}`} />
        <CardDescription className="pl-10">
          {t("day.appointment")} <span className="font-medium text-foreground">{DAYS[day].position}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
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
        <Separator />
        <div className="flex flex-col gap-1">
          <p className="font-medium">
            {t("times.title")} <span className="text-primary">*</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {t("times.hint")}
            {today ? ` ${t("times.hintLocal", { tz: localTimeZone() })}` : ""}
          </p>
        </div>
        <SlotGrid value={form[slotsKey]} onChange={(s) => set(slotsKey, s)} />
      </CardContent>
    </Card>
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
