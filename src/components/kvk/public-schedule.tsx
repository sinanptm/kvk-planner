"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { CalendarX2, Search } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStoredString } from "@/lib/client";
import {
  ALLIANCE_STYLES,
  DAYS,
  DAY_KEYS,
  SLOTS,
  formatSlotLocal,
  localTimeZone,
  localZoneAbbr,
  slotRangeUtc,
  slotUtc,
  useToday,
} from "@/lib/kvk";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AllianceTag } from "./alliance-tag";
import { useDayDate } from "./day-date";

export function PublicSchedule() {
  const schedule = useQuery(api.kvk.schedule.published);
  const [gameId] = useStoredString("kvk:gameId");
  const myTurns = useQuery(api.kvk.players.myTurns, gameId ? { gameId } : "skip");
  const [search, setSearch] = useState("");
  const [filledOnly, setFilledOnly] = useState(false);
  const today = useToday();
  const { t } = useLanguage();
  const dateOf = useDayDate();
  const q = search.trim().toLowerCase();
  const isMine = (day: string, slot: number) => !!myTurns?.some((t) => t.day === day && t.slot === slot);

  return (
    <>
      <PageHeader
        eyebrow={schedule?.eventName ?? "KvK"}
        title={t("schedule.title")}
        description={`${t("schedule.desc")}${today ? ` ${t("schedule.descLocal", { tz: localTimeZone() })}` : ""}`}
      />

      {schedule === null && (
        <Card className="py-10 text-center">
          <CardHeader className="justify-items-center">
            <CalendarX2 className="mx-auto mb-2 size-8 text-muted-foreground" />
            <CardTitle>{t("schedule.notPublished")}</CardTitle>
            <CardDescription>{t("schedule.notPublishedDesc")}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {schedule && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t("schedule.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="filled-only" checked={filledOnly} onCheckedChange={(v) => setFilledOnly(v)} />
              <Label htmlFor="filled-only" className="text-sm">
                {t("schedule.hideOpen")}
              </Label>
            </div>
          </div>
          {/* Wide screens: all three days side by side as a calendar. Phones: one day at a time. */}
          <ScheduleCalendar
            turns={schedule.turns}
            q={q}
            filledOnly={filledOnly}
            isMine={isMine}
            today={today}
          />
          <Tabs defaultValue="d1" className="md:hidden">
            <TabsList className="w-full">
              {DAY_KEYS.map((day) => (
                <TabsTrigger key={day} value={day} className="flex-1">
                  {t(`day.${day}`)}
                  <span className="hidden text-muted-foreground min-[480px]:inline">&nbsp;· {t(`day.${day}.title`)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {DAY_KEYS.map((day) => {
              const bySlot = new Map(schedule.turns.filter((t) => t.day === day).map((t) => [t.slot, t]));
              const rows = SLOTS.map((slot) => ({ slot, turn: bySlot.get(slot) })).filter(
                ({ turn }) =>
                  (!filledOnly || turn) &&
                  (!q || (turn && `${turn.alliance} ${turn.name}`.toLowerCase().includes(q))),
              );
              return (
                <TabsContent key={day} value={day} className="mt-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {dateOf(day) && <span className="font-medium text-foreground">{dateOf(day)} · </span>}
                      {DAYS[day].position} · {t(`day.${day}.title`)}
                    </span>
                    <span className="shrink-0 font-medium text-primary">
                      {t("schedule.filled", { n: bySlot.size, total: SLOTS.length })}
                    </span>
                  </div>
                  <ul className="flex flex-col overflow-hidden rounded-xl border bg-card">
                    {rows.map(({ slot, turn }) => {
                      const mine = isMine(day, slot);
                      return (
                        <li
                          key={slot}
                          className={cn(
                            "flex items-center gap-4 border-b px-4 py-3 last:border-b-0",
                            mine && "bg-primary/10",
                          )}
                        >
                          <div className="w-32 shrink-0">
                            <p className={cn("font-mono text-sm font-semibold", mine && "text-primary")}>
                              {slotRangeUtc(slot)} <span className="text-[10px] font-medium opacity-70">UTC</span>
                            </p>
                            {today && (
                              <p className="text-xs text-muted-foreground">
                                {formatSlotLocal(slot, today)} {localZoneAbbr(today) ?? t("times.local")}
                              </p>
                            )}
                          </div>
                          {turn ? (
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <AllianceTag alliance={turn.alliance} />
                              <span className="truncate font-medium">{turn.name}</span>
                              {mine && <Badge className="ml-auto">{t("schedule.you")}</Badge>}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">{t("schedule.open")}</span>
                          )}
                        </li>
                      );
                    })}
                    {rows.length === 0 && (
                      <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                        {t("schedule.noMatch", { day: t(`day.${day}`) })}
                      </li>
                    )}
                  </ul>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      )}
    </>
  );
}

type ScheduleTurn = { day: string; slot: number; name: string; alliance: string };

// The three days as calendar columns, one row per 30-minute turn, grouped into quarters of the day.
function ScheduleCalendar({
  turns,
  q,
  filledOnly,
  isMine,
  today,
}: {
  turns: ScheduleTurn[];
  q: string;
  filledOnly: boolean;
  isMine: (day: string, slot: number) => boolean;
  today: Date | null;
}) {
  const { t } = useLanguage();
  const dateOf = useDayDate();
  const byDay = new Map(DAY_KEYS.map((day) => [day, new Map(turns.filter((x) => x.day === day).map((x) => [x.slot, x]))]));
  const zone = today ? (localZoneAbbr(today) ?? t("times.local")) : "";
  const matches = (turn: ScheduleTurn | undefined) =>
    !q || (!!turn && `${turn.alliance} ${turn.name}`.toLowerCase().includes(q));

  return (
    <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
      {/* Day headers */}
      <div className="sticky top-14 z-10 grid grid-cols-[7.5rem_repeat(3,minmax(0,1fr))] border-b bg-card/95 backdrop-blur">
        <div className="px-3 py-3 text-xs font-medium text-muted-foreground">UTC</div>
        {DAY_KEYS.map((day) => {
          const filled = byDay.get(day)!.size;
          return (
            <div key={day} className="flex items-baseline justify-between gap-2 border-l px-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {t(`day.${day}`)} · {t(`day.${day}.title`)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {dateOf(day) ? `${dateOf(day)} · ` : ""}
                  {DAYS[day].position}
                </p>
              </div>
              <span className="shrink-0 text-xs font-medium text-primary">
                {t("schedule.filled", { n: filled, total: SLOTS.length })}
              </span>
            </div>
          );
        })}
      </div>

      {SLOTS.map((slot) => (
        <div
          key={slot}
          className={cn(
            "grid grid-cols-[7.5rem_repeat(3,minmax(0,1fr))]",
            slot % 12 === 0 && slot > 0 ? "border-t-2" : slot % 2 === 0 && slot > 0 ? "border-t" : "",
          )}
        >
          <div className="flex flex-col justify-center px-3 py-1">
            <span className="font-mono text-xs font-semibold">{slotUtc(slot)}</span>
            {today && (
              <span className="text-[10px] text-muted-foreground">
                {formatSlotLocal(slot, today)} {zone}
              </span>
            )}
          </div>
          {DAY_KEYS.map((day) => {
            const turn = byDay.get(day)!.get(slot);
            const mine = isMine(day, slot);
            const dim = !matches(turn);
            return (
              <div key={day} className="border-l p-1">
                {turn ? (
                  <div
                    className={cn(
                      "flex h-9 items-center gap-1.5 rounded-md border px-2 transition-opacity",
                      ALLIANCE_STYLES[turn.alliance]?.tile ?? "border-primary/40 bg-primary/10",
                      mine && "ring-2 ring-primary",
                      dim && "opacity-20",
                    )}
                  >
                    <AllianceTag alliance={turn.alliance} />
                    <span className="truncate text-sm font-medium">{turn.name}</span>
                    {mine && <Badge className="ml-auto shrink-0">{t("schedule.you")}</Badge>}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex h-9 items-center rounded-md border border-dashed px-2 text-xs text-muted-foreground",
                      (filledOnly || q) && "invisible",
                    )}
                  >
                    {t("schedule.open")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
