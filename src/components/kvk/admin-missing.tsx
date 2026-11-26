"use client";

import { api } from "@convex/_generated/api";
import { useAction, useQuery } from "convex/react";
import { ClipboardCopy, RefreshCw } from "lucide-react";
import { parseAsArrayOf, parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copyText, errorMessage } from "@/lib/client";
import { ALLIANCES, ALLIANCE_STYLES, tcLabel } from "@/lib/kvk";
import { cn } from "@/lib/utils";
import { AllianceTag } from "./alliance-tag";

// Two letters for the round badge; skips digits and symbols ("169Uno" → "UN"), "?" if none.
const initials = (name: string) => (name.match(/\p{L}/gu) ?? ["?"]).slice(0, 2).join("");

const timeAgo = (ms: number) => {
  const minutes = Math.round((Date.now() - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
};

// Town Center groups as the game reports levels (31-35 TG1, 36-40 TG2, 41-45 TG3, 46+ beyond).
const TC_GROUPS = [
  { key: "tg3", label: "TG3+", test: (l: number) => l >= 41 },
  { key: "tg2", label: "TG2", test: (l: number) => l >= 36 && l <= 40 },
  { key: "tg1", label: "TG1", test: (l: number) => l >= 31 && l <= 35 },
  { key: "tc", label: "TC 30 or lower", test: (l: number) => l <= 30 },
] as const;

// One alliance at a time: members in the game who have not signed up, filterable by Town Center level.
export function AdminMissing({ password }: { password: string }) {
  const data = useQuery(api.kvk.lookup.notSignedUp, { password });
  const refresh = useAction(api.kvk.lookup.refreshRosters);
  const [busy, setBusy] = useState(false);
  // Alliance and Town Center filters live in the URL, shared with the Players tab's alliance filter.
  const [allianceParam, setAlliance] = useQueryState("alliance", parseAsStringLiteral(ALLIANCES));
  const alliance = allianceParam ?? ALLIANCES[0];
  const [tc, setTc] = useQueryState(
    "tc",
    parseAsArrayOf(parseAsStringLiteral(TC_GROUPS.map((g) => g.key))).withDefault([]),
  );

  const current = data?.find((a) => a.alliance === alliance);

  const shown = useMemo(
    () =>
      (current?.members ?? [])
        .filter((m) => !m.signedUp && (tc.length === 0 || TC_GROUPS.some((g) => tc.includes(g.key) && g.test(m.tcLevel))))
        .sort((a, b) => b.tcLevel - a.tcLevel || a.name.localeCompare(b.name)),
    [current, tc],
  );
  const missingTotal = current ? current.total - current.signedUp : 0;

  const runRefresh = async () => {
    setBusy(true);
    try {
      const res = await refresh({ password });
      if (res.failed.length) toast.error(`Couldn't update ${res.failed.join(", ")}. Try again in a minute.`);
      else toast.success("Alliance member lists updated.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const fetched = data.filter((a) => a.fetchedAt !== null);
  const oldest = fetched.length ? Math.min(...fetched.map((a) => a.fetchedAt!)) : null;
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const copy = () =>
    copyText(
      [`[${alliance}] not signed up (${shown.length})`, ...shown.map((m) => m.name)].join("\n"),
      "List copied",
    );

  const groups = TC_GROUPS.map((g) => ({ ...g, members: shown.filter((m) => g.test(m.tcLevel)) })).filter(
    (g) => g.members.length > 0,
  );
  const levelCount = (test: (l: number) => boolean) =>
    (current?.members ?? []).filter((m) => !m.signedUp && test(m.tcLevel)).length;
  const loaded = data.filter((a) => a.fetchedAt !== null);
  const totals = loaded.reduce((t, a) => ({ in: t.in + a.signedUp, all: t.all + a.total }), { in: 0, all: 0 });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Who hasn&apos;t signed up</h2>
          <p className="text-sm text-muted-foreground">
            {oldest ? `Member lists from the game, updated ${timeAgo(oldest)}.` : "Member lists haven't been loaded yet."}
          </p>
        </div>
        <Button className="h-10" onClick={runRefresh} disabled={busy}>
          <RefreshCw data-icon="inline-start" className={cn(busy && "animate-spin")} />
          {busy ? "Updating…" : "Update from game"}
        </Button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* Alliances: a grid on phones, a side list on wide screens */}
        <Card size="sm" className="lg:sticky lg:top-20">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Signed up overall</span>
              <span className="font-mono text-sm font-semibold">
                {totals.in}/{totals.all}
              </span>
            </div>
            <div role="tablist" aria-label="Alliance" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-1">
              {data.map((a) => {
                const on = a.alliance === alliance;
                const notLoaded = a.fetchedAt === null;
                return (
                  <button
                    key={a.alliance}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => void setAlliance(a.alliance as (typeof ALLIANCES)[number])}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-lg border px-3 py-2 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      on ? ALLIANCE_STYLES[a.alliance]?.tile : "border-transparent hover:bg-muted/50",
                      notLoaded && !on && "opacity-60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <AllianceTag alliance={a.alliance} />
                      <span className="font-mono text-xs">
                        {notLoaded ? (
                          <span className="text-muted-foreground">not loaded</span>
                        ) : (
                          <>
                            <span className="font-semibold">{a.signedUp}</span>
                            <span className="text-muted-foreground">/{a.total}</span>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", ALLIANCE_STYLES[a.alliance]?.dot)}
                        style={{ width: `${a.total ? (a.signedUp / a.total) * 100 : 0}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {current?.fetchedAt === null ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <AllianceTag alliance={alliance} />
              <p className="text-sm text-muted-foreground">
                {alliance}&apos;s members aren&apos;t loaded yet. Press “Update from game” to load them.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-4">
              {/* Toolbar */}
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-2">
                  <AllianceTag alliance={alliance} />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{shown.length}</span>
                    {shown.length === missingTotal ? "" : ` of ${missingTotal}`} not signed up
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {TC_GROUPS.map((g) => (
                    <Chip key={g.key} on={tc.includes(g.key)} onClick={() => void setTc((x) => toggle(x, g.key))}>
                      {g.label} <span className="opacity-60">{levelCount(g.test)}</span>
                    </Chip>
                  ))}
                  <Button variant="outline" size="sm" className="ml-1" disabled={shown.length === 0} onClick={copy}>
                    <ClipboardCopy data-icon="inline-start" />
                    Copy names
                  </Button>
                </div>
              </div>

              {/* Members, grouped by Town Center level */}
              {groups.map((g) => (
                <section key={g.key} className="flex flex-col gap-2 border-t pt-3">
                  <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    {g.label}
                    <span className="rounded-full bg-muted px-1.5 font-mono">{g.members.length}</span>
                  </h3>
                  <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {g.members.map((m) => (
                      <li key={m.gameId} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
                          {initials(m.name)}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">{m.name}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{m.gameId}</span>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          <span className="font-mono text-xs font-semibold">{m.tcLevel ? tcLabel(m.tcLevel) : "—"}</span>
                          {m.rank && <span className="text-[10px] text-muted-foreground">{m.rank}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {shown.length === 0 && (
                <p className="border-t py-10 text-center text-sm text-muted-foreground">
                  {missingTotal === 0 ? `Everyone in ${alliance} has signed up.` : "Nobody at this level is missing."}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "h-7 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors",
        on ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
