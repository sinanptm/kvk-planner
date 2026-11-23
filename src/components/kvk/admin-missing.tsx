"use client";

import { api } from "@convex/_generated/api";
import { useAction, useQuery } from "convex/react";
import { ClipboardCopy, RefreshCw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { copyText, errorMessage } from "@/lib/client";
import { ALLIANCES, ALLIANCE_STYLES, searchPlayers, tcLabel } from "@/lib/kvk";
import { cn } from "@/lib/utils";
import { AllianceTag } from "./alliance-tag";

const timeAgo = (ms: number) => {
  const minutes = Math.round((Date.now() - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
};

const STATUS = [
  { key: "missing", label: "Not signed up" },
  { key: "done", label: "Signed up" },
  { key: "all", label: "All" },
] as const;
type Status = (typeof STATUS)[number]["key"];

const RANKS = ["R5", "R4", "R3", "R2", "R1"] as const;

// Town Center groups as the game reports levels (31-35 TG1, 36-40 TG2, 41-45 TG3, 46+ beyond).
const TC_GROUPS = [
  { key: "tg3", label: "TG3+", test: (l: number) => l >= 41 },
  { key: "tg2", label: "TG2", test: (l: number) => l >= 36 && l <= 40 },
  { key: "tg1", label: "TG1", test: (l: number) => l >= 31 && l <= 35 },
  { key: "tc", label: "TC 30 or lower", test: (l: number) => l <= 30 },
] as const;
type TcGroup = (typeof TC_GROUPS)[number]["key"];

const SORTS = [
  { key: "tc", label: "Town Center" },
  { key: "rank", label: "Rank" },
  { key: "name", label: "Name" },
] as const;
type Sort = (typeof SORTS)[number]["key"];

const rankValue = (rank: string) => Number(rank.replace(/\D/g, "")) || 0;

// One alliance at a time: who in the game has (not) signed up, with filters.
export function AdminMissing({ password }: { password: string }) {
  const data = useQuery(api.kvk.lookup.notSignedUp, { password });
  const refresh = useAction(api.kvk.lookup.refreshRosters);
  const [busy, setBusy] = useState(false);
  const [alliance, setAlliance] = useState<string>(ALLIANCES[0]);
  const [status, setStatus] = useState<Status>("missing");
  const [ranks, setRanks] = useState<string[]>([]);
  const [tc, setTc] = useState<TcGroup[]>([]);
  const [sort, setSort] = useState<Sort>("tc");
  const [search, setSearch] = useState("");

  const current = data?.find((a) => a.alliance === alliance);

  const shown = useMemo(() => {
    if (!current) return [];
    const filtered = current.members.filter(
      (m) =>
        (status === "all" || (status === "done") === m.signedUp) &&
        (ranks.length === 0 || ranks.includes(m.rank)) &&
        (tc.length === 0 || TC_GROUPS.some((g) => tc.includes(g.key) && g.test(m.tcLevel))),
    );
    const searched = searchPlayers(
      filtered.map((m) => ({ ...m, alliance })),
      search,
    );
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    return [...searched].sort((a, b) =>
      sort === "name"
        ? byName(a, b)
        : sort === "rank"
          ? rankValue(b.rank) - rankValue(a.rank) || b.tcLevel - a.tcLevel || byName(a, b)
          : b.tcLevel - a.tcLevel || rankValue(b.rank) - rankValue(a.rank) || byName(a, b),
    );
  }, [current, status, ranks, tc, sort, search, alliance]);

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
  const filtersOn = ranks.length > 0 || tc.length > 0 || search.trim() !== "";
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const copy = () =>
    copyText(
      [`[${alliance}] ${STATUS.find((s) => s.key === status)!.label} (${shown.length})`, ...shown.map((m) => m.name)].join(
        "\n",
      ),
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
              onClick={() => setAlliance(a.alliance)}
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
            {/* Filters */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    aria-label="Search members"
                    placeholder={`Search ${alliance} members`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-10 pl-9"
                  />
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                  {STATUS.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      aria-pressed={status === s.key}
                      onClick={() => setStatus(s.key)}
                      className={cn(
                        "rounded-md px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:px-3 sm:text-sm",
                        status === s.key
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <FilterRow label="Rank">
                {RANKS.map((r) => (
                  <Chip key={r} on={ranks.includes(r)} onClick={() => setRanks((x) => toggle(x, r))}>
                    {r}
                  </Chip>
                ))}
              </FilterRow>
              <FilterRow label="Level">
                {TC_GROUPS.map((g) => (
                  <Chip key={g.key} on={tc.includes(g.key)} onClick={() => setTc((x) => toggle(x, g.key))}>
                    {g.label}
                  </Chip>
                ))}
              </FilterRow>
              <FilterRow label="Sort">
                {SORTS.map((s) => (
                  <Chip key={s.key} on={sort === s.key} onClick={() => setSort(s.key)}>
                    {s.label}
                  </Chip>
                ))}
              </FilterRow>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{shown.length}</span> of{" "}
                {current?.total ?? 0} members
              </p>
              <div className="flex gap-2">
                {filtersOn && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRanks([]);
                      setTc([]);
                      setSearch("");
                    }}
                  >
                    <X data-icon="inline-start" />
                    Clear filters
                  </Button>
                )}
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
                  <span
                    className={cn("size-2 shrink-0 rounded-full", m.signedUp ? "bg-success" : "bg-muted-foreground/40")}
                    title={m.signedUp ? "Signed up" : "Not signed up"}
                  />
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
                  {status === "missing" && !filtersOn
                    ? `Everyone in ${alliance} has signed up.`
                    : "No members match these filters."}
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
