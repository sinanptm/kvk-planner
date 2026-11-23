"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DAYS, DAY_KEYS, formatDuration, localTimeZone, useToday, type DayKey } from "@/lib/kvk";
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

export const SPEEDUP_FIELDS: Record<DayKey, { key: SpeedupKey; label: string }[]> = {
  d1: [
    { key: "d1Construction", label: "Construction speedups" },
    { key: "d1Research", label: "Research speedups" },
    { key: "d1General", label: "General speedups for Day 1" },
  ],
  d4: [
    { key: "d4Training", label: "Training speedups" },
    { key: "d4General", label: "General speedups for Day 4" },
  ],
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
  return (
    <Card>
      <CardHeader>
        <StepTitle step={step} title={title} />
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        {gameId && (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="game-id">Game ID</Label>
            <Input
              id="game-id"
              required
              maxLength={32}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Your Kingshot player ID"
              value={gameId.value}
              onChange={(e) => gameId.onChange(e.target.value)}
              className="h-10 font-mono"
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">In-game name</Label>
          <Input
            id="name"
            required
            maxLength={40}
            placeholder="Name in Kingshot"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="alliance">Alliance tag</Label>
          <Input
            id="alliance"
            maxLength={10}
            placeholder="ABC"
            value={form.alliance}
            onChange={(e) => set("alliance", e.target.value)}
            className="h-10 uppercase"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Speedups and available times for one day.
export function DayCard({ day, form, set, step }: FieldProps & { day: DayKey; step: number }) {
  const today = useToday();
  const total = SPEEDUP_FIELDS[day].reduce((sum, f) => sum + form[f.key], 0);
  const slotsKey = day === "d1" ? "d1Slots" : "d4Slots";
  return (
    <Card>
      <CardHeader>
        <StepTitle step={step} title={`${DAYS[day].label} · ${DAYS[day].title}`} />
        <CardDescription className="pl-10">
          Appointment: <span className="font-medium text-foreground">{DAYS[day].position}</span>. Leave empty to skip
          this day.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-5">
          {SPEEDUP_FIELDS[day].map((f) => (
            <DurationInput
              key={f.key}
              id={f.key}
              label={f.label}
              value={form[f.key]}
              onChange={(minutes) => set(f.key, minutes)}
            />
          ))}
        </div>
        <div className="flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3">
          <span className="text-sm font-medium">{DAYS[day].label} total</span>
          <span className="font-mono text-xl font-bold text-primary">{formatDuration(total)}</span>
        </div>
        <Separator />
        <div className="flex flex-col gap-1">
          <p className="font-medium">Times available</p>
          <p className="text-xs text-muted-foreground">
            Pick every turn that works. Big numbers are UTC
            {today ? `, small numbers are your time (${localTimeZone()})` : ""}.
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
