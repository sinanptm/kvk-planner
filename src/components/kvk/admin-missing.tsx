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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Alliance sign-ups</h2>
          <p className="text-sm text-muted-foreground">
            {oldest ? `Member lists from the game, updated ${timeAgo(oldest)}.` : "Member lists haven't been loaded yet."}
          </p>
        </div>
        <Button className="h-10" onClick={runRefresh} disabled={busy}>
          <RefreshCw data-icon="inline-start" className={cn(busy && "animate-spin")} />
          {busy ? "Updating…" : "Update from game"}
        </Button>
      </div>

      {/* Pick one alliance */}
      <div role="tablist" aria-label="Alliance" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {data.map((a) => {
          const on = a.alliance === alliance;
          return (
            <button
              key={a.alliance}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => void setAlliance(a.alliance as (typeof ALLIANCES)[number])}
              className={cn(
                "flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                on ? ALLIANCE_STYLES[a.alliance]?.tile : "hover:bg-muted/50",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <AllianceTag alliance={a.alliance} />
                <span className="text-xs text-muted-foreground">
                  {a.fetchedAt === null ? "not loaded" : `${a.total - a.signedUp} missing`}
                </span>
              </div>
              <span className="font-mono text-lg font-bold">
                {a.fetchedAt === null ? "—" : `${a.signedUp}/${a.total}`}
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", ALLIANCE_STYLES[a.alliance]?.dot)}
                  style={{ width: `${a.total ? (a.signedUp / a.total) * 100 : 0}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {current?.fetchedAt === null ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Press “Update from game” to load {alliance}&apos;s members.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <FilterRow label="Level">
              {TC_GROUPS.map((g) => (
                <Chip key={g.key} on={tc.includes(g.key)} onClick={() => void setTc((x) => toggle(x, g.key))}>
                  {g.label}
                </Chip>
              ))}
            </FilterRow>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{shown.length}</span> of {missingTotal} not signed up
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={shown.length === 0} onClick={copy}>
                  <ClipboardCopy data-icon="inline-start" />
                  Copy names
                </Button>
              </div>
            </div>

            {/* Members */}
            <ul className="flex flex-col divide-y">
              {shown.map((m) => (
                <li key={m.gameId} className="flex items-center gap-3 py-2">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{m.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">ID {m.gameId}</span>
                  </div>
                  {m.rank && (
                    <span className="w-9 rounded-md bg-muted py-0.5 text-center font-mono text-xs font-semibold">
                      {m.rank}
                    </span>
                  )}
                  <span className="w-11 text-right font-mono text-xs text-muted-foreground">
                    {m.tcLevel ? tcLabel(m.tcLevel) : ""}
                  </span>
                </li>
              ))}
              {shown.length === 0 && (
                <li className="py-8 text-center text-sm text-muted-foreground">
                  {missingTotal === 0 ? `Everyone in ${alliance} has signed up.` : "Nobody at this level is missing."}
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
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
