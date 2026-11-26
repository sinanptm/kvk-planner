"use client";

import { api } from "@convex/_generated/api";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CalendarCheck, CalendarDays, CircleCheck, Eye, EyeOff, KeyRound, Send, LogOut, Users, type LucideIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage, useStoredString } from "@/lib/client";
import { DAYS, DAY_KEYS, SLOTS, dayDate } from "@/lib/kvk";
import { cn } from "@/lib/utils";
import { AdminDay } from "./admin-day";
import { AdminMissing } from "./admin-missing";
import { AdminPlayers } from "./admin-players";

export type Dashboard = NonNullable<FunctionReturnType<typeof api.kvk.admin.dashboard>>;

export function KvkAdmin() {
  const [password, setPassword] = useStoredString("kvk:adminPassword");

  return (
    <>
      <PageHeader eyebrow="Admin" title="KvK control room" description="Run sign-ups, assign turns and publish the schedule.">
        {password && (
          <Button variant="outline" onClick={() => setPassword(null)}>
            <LogOut data-icon="inline-start" />
            Log out
          </Button>
        )}
      </PageHeader>
      {password === undefined ? null : password ? (
        <AdminDashboard password={password} onLogout={() => setPassword(null)} />
      ) : (
        <AdminLogin onLogin={setPassword} />
      )}
    </>
  );
}

function AdminLogin({ onLogin }: { onLogin: (password: string) => void }) {
  const convex = useConvex();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (await convex.query(api.kvk.admin.verify, { password: value })) onLogin(value);
      else toast.error("Wrong password.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="items-center text-center">
        <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <KeyRound className="size-6" />
        </span>
        <CardTitle className="text-xl">Admin login</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Label htmlFor="admin-password" className="sr-only">
            Password
          </Label>
          <Input
            id="admin-password"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-11"
          />
          <Button type="submit" className="h-11 text-base" disabled={!value || busy}>
            Log in
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const ADMIN_TABS = ["d1", "d4", "players", "missing"] as const;
// Tabs share the width on phones and sit as a compact bar on wide screens.
const TAB_CLASS = "flex-1 gap-1.5 lg:flex-none lg:px-6";

function AdminDashboard({ password, onLogout }: { password: string; onLogout: () => void }) {
  const data = useQuery(api.kvk.admin.dashboard, { password });
  // The open tab lives in the URL (?tab=players), so reloads, links and the back button keep it.
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(ADMIN_TABS).withDefault("d1").withOptions({ history: "push" }),
  );

  if (data === undefined) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (data === null)
    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Password no longer valid</CardTitle>
          <CardDescription>The admin password was changed. Log in again.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onLogout}>Log in again</Button>
        </CardContent>
      </Card>
    );

  return (
    <>
      {!data.canEdit && (
        <div className="flex items-center gap-3 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3">
          <Eye className="size-5 shrink-0 text-sky-400" />
          <p className="text-sm">
            <span className="font-semibold">View only.</span>{" "}
            <span className="text-muted-foreground">
              You can look at everything, but changes are blocked. Only the main admin can assign turns, edit players
              or publish.
            </span>
          </p>
        </div>
      )}
      {/* Phones stack these; wide screens put status, dates and numbers in one row. */}
      <div className="grid gap-3 xl:grid-cols-12">
      <div className="xl:col-span-3">
        <PublishBanner password={password} data={data} />
      </div>
      <div className="xl:col-span-3">
        <EventDates password={password} data={data} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 xl:col-span-6">
        <Stat icon={Users} label="Players signed up" shortLabel="Players" value={data.players.length} />
        {DAY_KEYS.map((day) => {
          const filled = data.turns.filter((t) => t.day === day).length;
          return (
            <Stat
              key={day}
              icon={CalendarCheck}
              label={`${DAYS[day].label} · ${DAYS[day].title}`}
              shortLabel={DAYS[day].label}
              value={`${filled}/${SLOTS.length}`}
              progress={filled / SLOTS.length}
            />
          );
        })}
      </div>
      </div>
      <Tabs value={tab} onValueChange={(value) => void setTab(value as (typeof ADMIN_TABS)[number])}>
        <TabsList className="w-full group-data-horizontal/tabs:h-10 lg:w-auto lg:self-start">
          {DAY_KEYS.map((day) => (
            <TabsTrigger key={day} value={day} className={TAB_CLASS}>
              {DAYS[day].label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="players" className={TAB_CLASS}>
            Players
            <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{data.players.length}</span>
          </TabsTrigger>
          <TabsTrigger value="missing" className={TAB_CLASS}>
            Missing
          </TabsTrigger>
        </TabsList>
        {DAY_KEYS.map((day) => (
          <TabsContent key={day} value={day} className="mt-4">
            <AdminDay password={password} day={day} data={data} />
          </TabsContent>
        ))}
        <TabsContent value="players" className="mt-4">
          <AdminPlayers password={password} data={data} />
        </TabsContent>
        <TabsContent value="missing" className="mt-4">
          <AdminMissing password={password} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  shortLabel,
  value,
  progress,
}: {
  icon: LucideIcon;
  label: string;
  shortLabel: string;
  value: string | number;
  progress?: number;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex h-full flex-col gap-2 sm:gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-muted-foreground">
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </span>
          <span className="hidden size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary sm:flex">
            <Icon className="size-4" />
          </span>
        </div>
        <span className="font-mono text-xl font-bold sm:text-2xl">{value}</span>
        {progress !== undefined && (
          <div className="mt-auto h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Says in words whether players can see the schedule, with the one button that changes it.
function PublishBanner({ password, data }: { password: string; data: Dashboard }) {
  const update = useMutation(api.kvk.admin.updateSettings);
  const [busy, setBusy] = useState(false);
  const published = data.settings.schedulePublished;

  const setPublished = async (schedulePublished: boolean) => {
    setBusy(true);
    try {
      await update({ password, schedulePublished });
      toast.success(schedulePublished ? "Schedule published." : "Schedule hidden.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center",
        published ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10",
      )}
    >
      <div className="flex flex-1 items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            published ? "bg-success/20 text-success" : "bg-warning/20 text-warning",
          )}
        >
          {published ? <CircleCheck className="size-5" /> : <EyeOff className="size-5" />}
        </span>
        <div>
          <p className="font-semibold">{published ? "Schedule is live" : "Schedule is hidden"}</p>
          <p className="text-sm text-muted-foreground">
            {published ? "Players can see the schedule and their own turns." : "Players can\u2019t see any turns yet."}
          </p>
        </div>
      </div>
      {published ? (
        <Button variant="outline" className="h-11 shrink-0 px-5" disabled={busy} onClick={() => setPublished(false)}>
          <EyeOff data-icon="inline-start" />
          Unpublish
        </Button>
      ) : (
        <Button className="h-11 shrink-0 px-6 text-base" disabled={busy} onClick={() => setPublished(true)}>
          <Send data-icon="inline-start" />
          Publish schedule
        </Button>
      )}
    </div>
  );
}

// The date of Day 1, shown to players next to each day so they know when to be online. Day 4 follows from it.
function EventDates({ password, data }: { password: string; data: Dashboard }) {
  const update = useMutation(api.kvk.admin.updateSettings);
  const startDate = data.settings.startDate;

  const save = async (value: string) => {
    // Typing a year digit by digit passes through dates like 0002-11-30; wait for a real one.
    if (!value || value === startDate || Number(value.slice(0, 4)) < 2024) return;
    try {
      await update({ password, startDate: value });
      toast.success(`Day 1 set to ${dayDate(value, "d1", "en", true)}.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Card size="sm" className="h-full justify-center">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center xl:flex-col xl:items-stretch 2xl:flex-row 2xl:items-center">
        <div className="flex flex-1 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <CalendarDays className="size-5" />
          </span>
          <div>
            <p className="font-semibold">KvK prep dates</p>
            <p className="text-sm text-muted-foreground">
              {startDate
                ? DAY_KEYS.map((day) => `${DAYS[day].label}: ${dayDate(startDate, day)}`).join(" · ")
                : "Not set. Players won\u2019t see dates yet."}
            </p>
          </div>
        </div>
        <Label className="flex items-center gap-2 text-sm whitespace-nowrap text-muted-foreground">
          Day 1
          <Input
            type="date"
            className="h-10 flex-1 [color-scheme:dark] sm:w-44 sm:flex-none"
            defaultValue={startDate ?? ""}
            key={startDate ?? ""}
            onChange={(e) => void save(e.target.value)}
          />
        </Label>
      </CardContent>
    </Card>
  );
}
