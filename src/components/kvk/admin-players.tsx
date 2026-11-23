"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { ArrowLeft, Check, Copy, FileSpreadsheet, Pencil, Search, Trash2, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { copyText, errorMessage } from "@/lib/client";
import {
  ALLIANCES,
  DAYS,
  DAY_KEYS,
  dayScore,
  formatDuration,
  formatTruegold,
  searchPlayers,
  slotRangeUtc,
  slotUtc,
  tcLabel,
  dayDate,
} from "@/lib/kvk";
import { cn } from "@/lib/utils";
import type { Dashboard } from "./admin";
import { AddPlayer } from "./admin-add-player";
import { PlayerName } from "./alliance-tag";
import { ConfirmButton } from "./confirm-button";
import { EntryFields, toEntry, type Entry } from "./entry-form";

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function AdminPlayers({ password, data }: { password: string; data: Dashboard }) {
  const deletePlayer = useMutation(api.kvk.admin.deletePlayer);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const players = [...data.players].sort((a, b) => a._creationTime - b._creationTime);
  const turnOf = (gameId: string, day: "d1" | "d4") => data.turns.find((t) => t.gameId === gameId && t.day === day);

  const setInformed = useMutation(api.kvk.admin.setInformed);
  const informedCount = players.filter((p) => p.informed).length;

  // Plain text for in-game chat or DMs: the player's turn on each day, or that they have none.
  const turnMessage = (p: (typeof players)[number]) =>
    [
      "Your KvK appointment turns (UTC):",
      ...DAY_KEYS.map((day) => {
        const turn = turnOf(p.gameId, day);
        const date = dayDate(data.settings.startDate, day);
        return `${DAYS[day].label}${date ? ` (${date})` : ""} · ${DAYS[day].position}: ${turn ? slotRangeUtc(turn.slot) : "no turn this time"}`;
      }),
      "Please be online at the start of your turn.",
    ].join("\n");

  const run = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      toast.success(done);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const csv = () => {
    const header = [
      "game_id",
      "name",
      "alliance",
      "tc_level",
      "truegold",
      "d1_construction_min",
      "d1_research_min",
      "d1_general_min",
      "d1_total_min",
      "d1_times",
      "d1_turn_utc",
      "d4_training_min",
      "d4_general_min",
      "d4_total_min",
      "d4_times",
      "d4_turn_utc",
      "signed_up",
    ];
    const rows = players.map((p) => {
      const t1 = turnOf(p.gameId, "d1");
      const t4 = turnOf(p.gameId, "d4");
      return [
        p.gameId,
        p.name,
        p.alliance,
        p.tcLevel ? tcLabel(p.tcLevel) : "",
        p.truegold,
        p.d1Construction,
        p.d1Research,
        p.d1General,
        dayScore(p, "d1"),
        p.d1Slots.map(slotUtc).join(" "),
        t1 ? slotUtc(t1.slot) : "",
        p.d4Training,
        p.d4General,
        dayScore(p, "d4"),
        p.d4Slots.map(slotUtc).join(" "),
        t4 ? slotUtc(t4.slot) : "",
        new Date(p._creationTime).toISOString(),
      ];
    });
    return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  };

  const shown = searchPlayers(players, search);

  const editing = players.find((p) => p.gameId === editingId);
  if (adding && !editing)
    return <AddPlayer password={password} onDone={() => setAdding(false)} onEdit={setEditingId} />;
  if (editing)
    return (
      <EditPlayer
        key={editing.gameId}
        password={password}
        player={editing}
        onDone={() => {
          setEditingId(null);
          setAdding(false);
        }}
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <Button className="h-10" onClick={() => setAdding(true)}>
          <UserPlus data-icon="inline-start" />
          Add player
        </Button>
        <Button variant="outline" className="h-10" onClick={() => copyText(csv(), "CSV copied")} disabled={players.length === 0}>
          <FileSpreadsheet data-icon="inline-start" />
          Copy as CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            All players ({search.trim() ? `${shown.length} of ${players.length}` : players.length})
          </CardTitle>
          <CardDescription>
            In sign-up order · {informedCount}/{players.length} informed. Copy a player&apos;s turns to send them, then
            mark them informed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-0 sm:px-4">
          <div className="relative mx-4 sm:mx-0">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search players"
              placeholder="Search by name, alliance or game ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9"
            />
          </div>
          <ul className="flex flex-col divide-y px-4 sm:px-0">
            {shown.map((p) => (
              <li key={p.gameId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <PlayerName player={p} className="max-w-full font-medium" />
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      ID {p.gameId} · {p.tcLevel ? tcLabel(p.tcLevel) : "TC ?"} · {formatTruegold(p.truegold)} TG
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-1 sm:order-last">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Copy message for ${p.name}`}
                      title="Copy message with their turns"
                      onClick={() => copyText(turnMessage(p), `Message for ${p.name} copied`)}
                    >
                      <Copy />
                    </Button>
                    <Button
                      variant={p.informed ? "default" : "outline"}
                      size="sm"
                      aria-pressed={!!p.informed}
                      aria-label={p.informed ? `${p.name} is informed` : `Mark ${p.name} informed`}
                      title={p.informed ? "Informed — click to undo" : "Mark informed"}
                      className={cn("h-8 gap-1 px-2.5", p.informed && "bg-success text-background hover:bg-success/90")}
                      onClick={() =>
                        run(
                          () => setInformed({ password, gameId: p.gameId, informed: !p.informed }),
                          p.informed ? `${p.name} marked not informed` : `${p.name} marked informed`,
                        )
                      }
                    >
                      <Check className="size-3.5" />
                      <span className="hidden sm:inline">{p.informed ? "Informed" : "Mark informed"}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${p.name}`}
                      onClick={() => setEditingId(p.gameId)}
                    >
                      <Pencil />
                    </Button>
                    <ConfirmButton
                      variant="ghost"
                      size="icon-sm"
                      title={`Delete ${p.name}?`}
                      description="Removes their entry and any turns they have."
                      actionLabel="Delete"
                      onConfirm={() => run(() => deletePlayer({ password, gameId: p.gameId }), `${p.name} deleted.`)}
                    >
                      <Trash2 aria-label="Delete player" />
                    </ConfirmButton>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:w-72 sm:shrink-0">
                  {(["d1", "d4"] as const).map((day) => {
                    const turn = turnOf(p.gameId, day);
                    const picked = day === "d1" ? p.d1Slots.length : p.d4Slots.length;
                    return (
                      <div key={day} className="rounded-lg bg-muted px-2.5 py-1.5 text-xs">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="whitespace-nowrap text-muted-foreground">{day === "d1" ? "Day 1" : "Day 4"}</span>
                          <span className="font-mono text-sm font-medium whitespace-nowrap">
                            {formatDuration(dayScore(p, day)).split(" ").slice(0, 2).join(" ")}
                          </span>
                        </div>
                        <div className="text-muted-foreground">
                          {picked} times{turn ? ` · turn ${slotUtc(turn.slot)}` : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
            {shown.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                {players.length === 0 ? "No players yet." : "No player matches that search."}
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// Admin-only edit of a player's entry. The game ID cannot be changed.
function EditPlayer({
  password,
  player,
  onDone,
}: {
  password: string;
  player: Dashboard["players"][number];
  onDone: () => void;
}) {
  const updatePlayer = useMutation(api.kvk.admin.updatePlayer);
  const [form, setForm] = useState<Entry>(() => toEntry(player));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Entry>(key: K, value: Entry[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.tcLevel) return void toast.error("Pick this player's Town Center level.");
    if (!ALLIANCES.includes(form.alliance as (typeof ALLIANCES)[number]))
      return void toast.error("Pick an alliance for this player.");
    setSaving(true);
    try {
      await updatePlayer({ password, gameId: player.gameId, ...form });
      toast.success(`${form.name.trim()} updated.`);
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
        <Button type="button" variant="outline" className="h-10" onClick={onDone}>
          <ArrowLeft data-icon="inline-start" />
          All players
        </Button>
        <p className="text-sm text-muted-foreground">
          Editing <span className="font-medium text-foreground">{player.name}</span> · ID{" "}
          <span className="font-mono">{player.gameId}</span>. Turns already assigned are kept.
        </p>
      </div>
      <EntryFields form={form} set={set} detailsTitle="Player details" />
      <div className="flex gap-2">
        <Button type="submit" className="h-11 px-8" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
