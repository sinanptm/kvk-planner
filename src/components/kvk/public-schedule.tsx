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
  slotUtc,
  useToday,
} from "@/lib/kvk";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AllianceTag } from "./alliance-tag";
import { useDayDate } from "./day-date";

// UTC quarters of the day, 12 turns each (same layout as the admin turn grid).
const PERIODS = ["00:00–06:00", "06:00–12:00", "12:00–18:00", "18:00–24:00"].map((label, i) => ({
  label,
  slots: SLOTS.slice(i * 12, i * 12 + 12),
}));

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
          {/* One day at a time, laid out like the admin grid: four quarters of the day, a tile per turn. */}
          <Tabs defaultValue="d1">
            <TabsList className="w-full group-data-horizontal/tabs:h-10 lg:w-auto lg:self-start">
              {DAY_KEYS.map((day) => (
                <TabsTrigger key={day} value={day} className="flex-1 lg:flex-none lg:px-6">
                  {t(`day.${day}`)}
                  <span className="hidden text-muted-foreground min-[480px]:inline">&nbsp;· {t(`day.${day}.title`)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {DAY_KEYS.map((day) => {
              const bySlot = new Map(schedule.turns.filter((t) => t.day === day).map((t) => [t.slot, t]));
              const zone = today ? (localZoneAbbr(today) ?? t("times.local")) : "";
              const matches = (turn: (typeof schedule.turns)[number] | undefined) =>
                !q || (!!turn && `${turn.alliance} ${turn.name}`.toLowerCase().includes(q));
              return (
                <TabsContent key={day} value={day} className="mt-3 flex flex-col gap-5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {dateOf(day) && <span className="font-medium text-foreground">{dateOf(day)} · </span>}
                      {DAYS[day].position} · {t(`day.${day}.title`)}
                    </span>
                    <span className="shrink-0 font-medium text-primary">
                      {t("schedule.filled", { n: bySlot.size, total: SLOTS.length })}
                    </span>
                  </div>
                  {PERIODS.map((period) => {
                    const shown = period.slots.filter((slot) => !filledOnly || bySlot.has(slot));
                    if (shown.length === 0) return null;
                    return (
                      <div key={period.label} className="flex flex-col gap-2">
                        <p className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                          <span>{period.label} UTC</span>
                          <span>
                            {t("schedule.filled", {
                              n: period.slots.filter((slot) => bySlot.has(slot)).length,
                              total: period.slots.length,
                            })}
                          </span>
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                          {shown.map((slot) => {
                            const turn = bySlot.get(slot);
                            const mine = isMine(day, slot);
                            return (
                              <div
                                key={slot}
                                className={cn(
                                  "flex min-w-0 flex-col gap-0.5 rounded-lg border p-2.5 transition-opacity",
                                  turn
                                    ? (ALLIANCE_STYLES[turn.alliance]?.tile ?? "border-primary/40 bg-primary/10")
                                    : "border-dashed",
                                  mine && "ring-2 ring-primary",
                                  !matches(turn) && "opacity-25",
                                )}
                              >
                                <div className="flex items-baseline gap-1.5">
                                  <span className="font-mono text-sm font-semibold">{slotUtc(slot)}</span>
                                  {today && (
                                    <span className="truncate text-[11px] text-muted-foreground">
                                      {formatSlotLocal(slot, today)} {zone}
                                    </span>
                                  )}
                                  {mine && <Badge className="ml-auto shrink-0">{t("schedule.you")}</Badge>}
                                </div>
                                {turn ? (
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <AllianceTag alliance={turn.alliance} />
                                    <span className="truncate text-sm font-medium">{turn.name}</span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">{t("schedule.open")}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {filledOnly && bySlot.size === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {t("schedule.noMatch", { day: t(`day.${day}`) })}
                    </p>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      )}
    </>
  );
}

