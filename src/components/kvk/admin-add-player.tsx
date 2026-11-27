"use client";

import { api } from "@convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { ArrowLeft, Pencil, Search, UserPlus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/client";
import { ALLIANCES, searchPlayers, tcLabel } from "@/lib/kvk";
import { AllianceTag } from "./alliance-tag";
import { EMPTY_ENTRY, EntryFields, useEntryForm } from "./entry-form";

type Found = { gameId: string; name: string; alliance: string; tcLevel: number };

const MAX_RESULTS = 8;

// Admin adds a player on their behalf: find them by name or ID, then fill in speedups and times.
export function AddPlayer({
  password,
  onDone,
  onEdit,
}: {
  password: string;
  onDone: () => void;
  onEdit: (gameId: string) => void;
}) {
  const [picked, setPicked] = useState<Found | null>(null);
  return picked ? (
    <AddForm password={password} player={picked} onBack={() => setPicked(null)} onDone={onDone} />
  ) : (
    <FindPlayer password={password} onPick={setPicked} onEdit={onEdit} onDone={onDone} />
  );
}

// Searches every member of our alliances (from the last "Update from game"), or looks any game ID up.
function FindPlayer({
  password,
  onPick,
  onEdit,
  onDone,
}: {
  password: string;
  onPick: (p: Found) => void;
  onEdit: (gameId: string) => void;
  onDone: () => void;
}) {
  const rosters = useQuery(api.kvk.lookup.notSignedUp, { password });
  const lookup = useAction(api.kvk.lookup.player);
  const [query, setQuery] = useState("");
  const [looking, setLooking] = useState(false);

  const members = useMemo(
    () => (rosters ?? []).flatMap((r) => r.members.map((m) => ({ ...m, alliance: r.alliance }))),
    [rosters],
  );
  const results = query.trim() ? searchPlayers(members, query).slice(0, MAX_RESULTS) : [];
  const id = query.trim();
  const isId = /^\d{3,15}$/.test(id);
  const loaded = !!rosters?.some((r) => r.fetchedAt !== null);

  const lookUp = async () => {
    setLooking(true);
    try {
      const res = await lookup({ gameId: id });
      if (res.status === "ok") return onPick({ gameId: id, name: res.name ?? "", alliance: res.alliance ?? "", tcLevel: res.tcLevel ?? 0 });
      const why = {
        not_found: "No player with this ID in the game.",
        wrong_kingdom: `${res.name} is in kingdom ${res.kid}, not ours.`,
        wrong_alliance: `${res.name} is in ${res.alliance || "no alliance"}, not one of ours.`,
        pending: "The game is still looking this player up. Try again in a few seconds.",
        error: "Couldn't reach the game right now. Try again in a minute.",
      }[res.status];
      toast.error(why);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLooking(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" className="h-10" onClick={onDone}>
          <ArrowLeft data-icon="inline-start" />
          All players
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Add a player</CardTitle>
          <CardDescription>
            Search our alliances by name or game ID, then enter their speedups and times for them.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              type="search"
              placeholder="Name or game ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 pl-9"
            />
          </div>
          {rosters && !loaded && (
            <p className="text-sm text-muted-foreground">
              Alliance member lists aren&apos;t loaded, so only game IDs can be looked up. Load them with “Update from
              game” on the Missing tab.
            </p>
          )}

          {results.length > 0 && (
            <ul className="flex flex-col divide-y rounded-lg border">
              {results.map((m) => (
                <li key={m.gameId}>
                  <button
                    type="button"
                    onClick={() => (m.signedUp ? onEdit(m.gameId) : onPick(m))}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
                  >
                    <AllianceTag alliance={m.alliance} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{m.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        ID {m.gameId}
                        {m.tcLevel ? ` · ${tcLabel(m.tcLevel)}` : ""}
                      </span>
                    </span>
                    {m.signedUp ? (
                      <Badge variant="secondary" className="gap-1">
                        <Pencil className="size-3" />
                        Signed up · edit
                      </Badge>
                    ) : (
                      <UserPlus className="size-4 text-primary" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {isId && !results.some((m) => m.gameId === id) && (
            <Button variant="outline" className="h-10 self-start" disabled={looking} onClick={lookUp}>
              <Search data-icon="inline-start" />
              {looking ? "Looking up…" : `Look up ID ${id} in the game`}
            </Button>
          )}
          {query.trim() && results.length === 0 && !isId && (
            <p className="py-4 text-center text-sm text-muted-foreground">Nobody in our alliances matches that.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddForm({
  password,
  player,
  onBack,
  onDone,
}: {
  password: string;
  player: Found;
  onBack: () => void;
  onDone: () => void;
}) {
  const addPlayer = useMutation(api.kvk.admin.addPlayer);
  const [form, set] = useEntryForm(() => ({
    ...EMPTY_ENTRY,
    name: player.name,
    alliance: player.alliance,
    tcLevel: player.tcLevel,
  }));
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.tcLevel) return void toast.error("Pick this player's Town Center level.");
    if (!ALLIANCES.includes(form.alliance as (typeof ALLIANCES)[number]))
      return void toast.error("Pick an alliance for this player.");
    setSaving(true);
    try {
      await addPlayer({ password, gameId: player.gameId, ...form });
      toast.success(`${form.name.trim()} added.`);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" className="h-10" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" />
          Search again
        </Button>
        <p className="text-sm text-muted-foreground">
          Adding <span className="font-medium text-foreground">{player.name || "a player"}</span> · ID{" "}
          <span className="font-mono">{player.gameId}</span>
        </p>
      </div>
      <EntryFields form={form} set={set} detailsTitle="Player details" />
      <div className="flex gap-2">
        <Button type="submit" className="h-11 px-8" disabled={saving}>
          {saving ? "Saving…" : "Add player"}
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
