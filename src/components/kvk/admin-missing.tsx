"use client";

import { api } from "@convex/_generated/api";
import { useAction, useQuery } from "convex/react";
import { ClipboardCopy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { copyText, errorMessage } from "@/lib/client";
import { ALLIANCE_STYLES, tcLabel } from "@/lib/kvk";
import { cn } from "@/lib/utils";
import { AllianceTag } from "./alliance-tag";

const timeAgo = (ms: number) => {
  const minutes = Math.round((Date.now() - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
};

// Alliance members (from the game, via MightPulse) who have not signed up yet.
export function AdminMissing({ password }: { password: string }) {
  const data = useQuery(api.kvk.lookup.notSignedUp, { password });
  const refresh = useAction(api.kvk.lookup.refreshRosters);
  const [busy, setBusy] = useState(false);

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
  const totalMissing = data.reduce((n, a) => n + a.missing.length, 0);

  const listText = () =>
    data
      .filter((a) => a.missing.length)
      .map((a) => [`[${a.alliance}] not signed up (${a.missing.length})`, ...a.missing.map((m) => m.name)].join("\n"))
      .join("\n\n");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Not signed up yet</h2>
          <p className="text-sm text-muted-foreground">
            Members of each alliance in the game who have no sign-up.{" "}
            {oldest ? `Member lists updated ${timeAgo(oldest)}.` : "Member lists haven't been loaded yet."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="h-10 flex-1 sm:flex-none" onClick={runRefresh} disabled={busy}>
            <RefreshCw data-icon="inline-start" className={cn(busy && "animate-spin")} />
            {busy ? "Updating…" : "Update from game"}
          </Button>
          <Button
            variant="outline"
            className="h-10"
            disabled={totalMissing === 0}
            onClick={() => copyText(listText(), "List copied")}
          >
            <ClipboardCopy data-icon="inline-start" />
            Copy list
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {data.map((a) => (
          <div key={a.alliance} className="flex flex-col gap-1 rounded-lg border p-3">
            <AllianceTag alliance={a.alliance} className="self-start" />
            <span className="font-mono text-xl font-bold">
              {a.fetchedAt === null ? "—" : `${a.signedUp}/${a.total}`}
            </span>
            <span className="text-xs text-muted-foreground">signed up</span>
            {a.total > 0 && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", ALLIANCE_STYLES[a.alliance]?.dot)}
                  style={{ width: `${(a.signedUp / a.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {data.map((a) => (
        <Card key={a.alliance} size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AllianceTag alliance={a.alliance} />
              {a.fetchedAt === null ? "Not loaded" : `${a.missing.length} not signed up`}
            </CardTitle>
            {a.fetchedAt === null && <CardDescription>Press “Update from game” to load this alliance.</CardDescription>}
          </CardHeader>
          {a.missing.length > 0 && (
            <CardContent>
              <ul className="grid gap-x-4 sm:grid-cols-2">
                {a.missing.map((m) => (
                  <li key={m.gameId} className="flex items-center gap-2 border-b py-1.5 text-sm last:border-b-0">
                    <span className="min-w-0 flex-1 truncate">{m.name}</span>
                    {m.rank && <span className="text-xs text-muted-foreground">{m.rank}</span>}
                    <span className="w-10 text-right font-mono text-xs text-muted-foreground">
                      {m.tcLevel ? tcLabel(m.tcLevel) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
