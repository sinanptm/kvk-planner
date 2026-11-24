"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Ban, CalendarCheck, CalendarDays, Hourglass, CircleCheck, EyeOff, KeyRound, Send, Shield, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/client";
import { DAYS, DAY_KEYS, MAX_ALLIANCES, SLOTS, cleanAlliances, dayDate } from "@/lib/kvk";
import { cn } from "@/lib/utils";
import { AdminDay } from "./admin-day";
import { AdminMissing } from "./admin-missing";
import { AdminPlayers } from "./admin-players";
import { useKingdom } from "./kingdom-context";

export type Dashboard = NonNullable<FunctionReturnType<typeof api.kvk.admin.dashboard>>;

// The kingdom's control room. Only the account that set the kingdom up can use it.
export function KvkAdmin() {
  const { number } = useKingdom();
  const { isLoading, isAuthenticated } = useConvexAuth();

  return (
    <>
      <PageHeader
        eyebrow={`Kingdom #${number} · Admin`}
        title="KvK control room"
        description="Run sign-ups, assign turns and publish the schedule."
      />
      {isLoading ? null : isAuthenticated ? (
        <AdminDashboard kingdom={number} />
      ) : (
        <Gate
          icon={KeyRound}
          title="Log in to manage this kingdom"
          description={`Only the leader who set up kingdom #${number} can open its admin page.`}
          href={`/login?next=/${number}/admin`}
          action="Log in"
        />
      )}
    </>
  );
}

function Gate({
  icon: Icon,
  title,
  description,
  href,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <Card className="mx-auto w-full max-w-md text-center">
      <CardHeader className="items-center">
        <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Icon className="size-6" />
        </span>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={href} className={cn(buttonVariants(), "h-11 w-full text-base")}>
          {action}
        </Link>
      </CardContent>
    </Card>
  );
}

function AdminDashboard({ kingdom }: { kingdom: number }) {
  const data = useQuery(api.kvk.admin.dashboard, { kingdom });

  if (data === undefined) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (data === null)
    return (
      <Gate
        icon={Shield}
        title="Not your kingdom"
        description={`This account doesn\u2019t run kingdom #${kingdom}. Log in with the account that set it up.`}
        href="/account"
        action="Go to my kingdoms"
      />
    );
  if (data.kingdom.status !== "approved")
    return (
      <Gate
        icon={data.kingdom.status === "pending" ? Hourglass : Ban}
        title={data.kingdom.status === "pending" ? "Waiting for approval" : "Not approved"}
        description={
          data.kingdom.status === "pending"
            ? `Kingdom #${kingdom} is set up. It opens for you and your players as soon as it\u2019s approved, usually within a day.`
            : `Kingdom #${kingdom} wasn\u2019t approved. Contact the developer if you think this is a mistake.`
        }
        href="/support"
        action="Contact the developer"
      />
    );

  return (
    <>
      <PublishBanner kingdom={kingdom} data={data} />
      <EventDates kingdom={kingdom} data={data} />
      <AllianceSettings kingdom={kingdom} data={data} />
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat icon={Users} label="Players signed up" shortLabel="Players" value={data.players.length} />
        {DAY_KEYS.map((day) => {
          const filled = data.turns.filter((t) => t.day === day).length;
          return (
            <Stat
              key={day}
              icon={CalendarCheck}
              label={`${DAYS[day].label} · ${DAYS[day].position}`}
              shortLabel={DAYS[day].label}
              value={`${filled}/${SLOTS.length}`}
              progress={filled / SLOTS.length}
            />
          );
        })}
      </div>
      <Tabs defaultValue="d1">
        <TabsList className="w-full">
          {DAY_KEYS.map((day) => (
            <TabsTrigger key={day} value={day} className="flex-1">
              {DAYS[day].label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="players" className="flex-1">
            Players
          </TabsTrigger>
          <TabsTrigger value="missing" className="flex-1">
            Missing
          </TabsTrigger>
        </TabsList>
        {DAY_KEYS.map((day) => (
          <TabsContent key={day} value={day} className="mt-4">
            <AdminDay kingdom={kingdom} day={day} data={data} />
          </TabsContent>
        ))}
        <TabsContent value="players" className="mt-4">
          <AdminPlayers kingdom={kingdom} data={data} />
        </TabsContent>
        <TabsContent value="missing" className="mt-4">
          <AdminMissing kingdom={kingdom} />
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
function PublishBanner({ kingdom, data }: { kingdom: number; data: Dashboard }) {
  const update = useMutation(api.kvk.kingdoms.update);
  const [busy, setBusy] = useState(false);
  const published = data.kingdom.schedulePublished;

  const setPublished = async (schedulePublished: boolean) => {
    setBusy(true);
    try {
      await update({ kingdom, schedulePublished });
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
        "flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center",
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
        <Button variant="outline" className="h-11 px-5" disabled={busy} onClick={() => setPublished(false)}>
          <EyeOff data-icon="inline-start" />
          Unpublish
        </Button>
      ) : (
        <Button className="h-11 px-6 text-base" disabled={busy} onClick={() => setPublished(true)}>
          <Send data-icon="inline-start" />
          Publish schedule
        </Button>
      )}
    </div>
  );
}

// The date of Day 1, shown to players next to each day so they know when to be online. Day 4 follows from it.
function EventDates({ kingdom, data }: { kingdom: number; data: Dashboard }) {
  const update = useMutation(api.kvk.kingdoms.update);
  const startDate = data.kingdom.startDate;

  const save = async (value: string) => {
    // Typing a year digit by digit passes through dates like 0002-11-30; wait for a real one.
    if (!value || value === startDate || Number(value.slice(0, 4)) < 2024) return;
    try {
      await update({ kingdom, startDate: value });
      toast.success(`Day 1 set to ${dayDate(value, "d1", "en", true)}.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
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

// The alliances whose members may sign up. Players outside them are turned away at sign-up.
function AllianceSettings({ kingdom, data }: { kingdom: number; data: Dashboard }) {
  const update = useMutation(api.kvk.kingdoms.update);
  const saved = data.kingdom.alliances.join(", ");
  const [value, setValue] = useState(saved);
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const tags = cleanAlliances(value.split(/[\s,]+/));
    if (!tags) return void toast.error(`Enter 1 to ${MAX_ALLIANCES} alliance tags, like VIK, TEA.`);
    setBusy(true);
    try {
      await update({ kingdom, alliances: tags });
      setValue(tags.join(", "));
      toast.success("Alliances saved.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card size="sm">
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Users className="size-5" />
            </span>
            <div>
              <p className="font-semibold">Alliances</p>
              <p className="text-sm text-muted-foreground">Only members of these alliances can sign up.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Label htmlFor="alliances" className="sr-only">
              Alliance tags
            </Label>
            <Input
              id="alliances"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="VIK, TEA, BTF"
              className="h-10 min-w-0 flex-1 font-mono uppercase sm:w-56 sm:flex-none"
            />
            <Button type="submit" variant="outline" className="h-10" disabled={busy || value.trim() === saved}>
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
