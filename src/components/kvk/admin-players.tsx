"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { ArrowLeft, FileSpreadsheet, Pencil, RotateCcw, Search, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { copyText, errorMessage } from "@/lib/client";
import { dayScore, formatDuration, searchPlayers, slotUtc } from "@/lib/kvk";
import type { Dashboard } from "./admin";
import { ConfirmButton } from "./confirm-button";
import { EntryFields, toEntry, type Entry } from "./entry-form";

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function AdminPlayers({ password, data }: { password: string; data: Dashboard }) {
  const deletePlayer = useMutation(api.kvk.admin.deletePlayer);
  const resetEvent = useMutation(api.kvk.admin.resetEvent);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const players = [...data.players].sort((a, b) => a._creationTime - b._creationTime);
  const turnOf = (gameId: string, day: "d1" | "d4") => data.turns.find((t) => t.gameId === gameId && t.day === day);

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
  if (editing)
    return <EditPlayer key={editing.gameId} password={password} player={editing} onDone={() => setEditingId(null)} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-10" onClick={() => copyText(csv(), "CSV copied")} disabled={players.length === 0}>
          <FileSpreadsheet data-icon="inline-start" />
          Copy as CSV
        </Button>
        <ConfirmButton
          title="Start a new KvK?"
          description="Deletes every player and every turn and hides the schedule. This cannot be undone."
          actionLabel="Wipe and start over"
          confirmWord="RESET"
          className="h-10"
          onConfirm={() => run(() => resetEvent({ password, confirm: "RESET" }), "New KvK started.")}
        >
          <RotateCcw data-icon="inline-start" />
          Start a new KvK
        </ConfirmButton>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            All players ({search.trim() ? `${shown.length} of ${players.length}` : players.length})
          </CardTitle>
          <CardDescription>In sign-up order. Players can&apos;t edit their own entry — use the pencil to change one.</CardDescription>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Game ID</TableHead>
                <TableHead>Day 1</TableHead>
                <TableHead>Day 4</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((p) => (
                <TableRow key={p.gameId}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    {p.alliance && <div className="text-xs text-muted-foreground">[{p.alliance}]</div>}
                  </TableCell>
                  <TableCell className="font-mono">{p.gameId}</TableCell>
                  {(["d1", "d4"] as const).map((day) => {
                    const turn = turnOf(p.gameId, day);
                    const picked = day === "d1" ? p.d1Slots.length : p.d4Slots.length;
                    return (
                      <TableCell key={day}>
                        <div>{formatDuration(dayScore(p, day))}</div>
                        <div className="text-xs text-muted-foreground">
                          {picked} times{turn ? ` · turn ${slotUtc(turn.slot)}` : ""}
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="whitespace-nowrap">
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
                  </TableCell>
                </TableRow>
              ))}
              {shown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {players.length === 0 ? "No players yet." : "No player matches that search."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
