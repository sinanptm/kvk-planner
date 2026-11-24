"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Ban, Check, ExternalLink, Search, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/client";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "@/components/kvk/confirm-button";

type Row = NonNullable<FunctionReturnType<typeof api.superAdmin.overview>>[number];
type Status = Row["status"];

const TABS: { status: Status; label: string }[] = [
  { status: "pending", label: "Waiting" },
  { status: "approved", label: "Approved" },
  { status: "rejected", label: "Rejected" },
];

const when = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(ms);

// The developer's page: approve the kingdoms leaders set up. Nothing opens until it's approved here.
export function SuperAdmin() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const rows = useQuery(api.superAdmin.overview, isAuthenticated ? {} : "skip");
  const [tab, setTab] = useState<Status>("pending");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login?next=/super");
  }, [isLoading, isAuthenticated, router]);

  if (!isAuthenticated || rows === undefined) return null;
  if (rows === null)
    return <PageHeader eyebrow="Super admin" title="Not allowed" description="This account isn't a super admin." />;

  const q = search.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      r.status === tab &&
      (!q ||
        [String(r.number), r.ownerEmail ?? "", r.ownerName ?? "", r.ownerGameId, ...r.alliances]
          .join(" ")
          .toLowerCase()
          .includes(q)),
  );
  const count = (s: Status) => rows.filter((r) => r.status === s).length;

  return (
    <>
      <PageHeader
        eyebrow="Super admin"
        title="Kingdoms"
        description="New kingdoms wait here until you approve them. Players and the leader can't use a kingdom before that."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div role="tablist" className="grid flex-1 grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {TABS.map((t) => (
            <button
              key={t.status}
              type="button"
              role="tab"
              aria-selected={tab === t.status}
              onClick={() => setTab(t.status)}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground",
                tab === t.status && "bg-background text-foreground shadow-sm",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 font-mono text-xs",
                  t.status === "pending" && count("pending") > 0 ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {count(t.status)}
              </span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Kingdom, email, name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {shown.map((r) => (
          <KingdomRow key={r.number} row={r} />
        ))}
        {shown.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {tab === "pending" ? "No kingdoms waiting for approval." : "Nothing here."}
          </p>
        )}
      </div>
    </>
  );
}

function KingdomRow({ row: r }: { row: Row }) {
  const setStatus = useMutation(api.superAdmin.setStatus);
  const remove = useMutation(api.superAdmin.deleteKingdom);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-bold">#{r.number}</span>
            <span className="font-mono text-xs text-muted-foreground">{r.alliances.join(" · ")}</span>
            {r.status === "approved" && (
              <Link
                href={`/${r.number}`}
                target="_blank"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Open kingdom ${r.number}`}
              >
                <ExternalLink className="size-3.5" />
              </Link>
            )}
          </div>
          <p className="truncate text-sm">
            {r.ownerName ?? "Unknown"}
            {r.ownerAlliance && <span className="text-muted-foreground"> [{r.ownerAlliance}]</span>}
            <span className="text-muted-foreground"> · ID {r.ownerGameId}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {r.ownerEmail ?? "no email"} · set up {when(r.createdAt)} · {r.players} players
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {r.status !== "approved" && (
            <Button
              className="h-10"
              disabled={busy}
              onClick={() => run(() => setStatus({ kingdom: r.number, status: "approved" }), `#${r.number} approved.`)}
            >
              <Check data-icon="inline-start" />
              Approve
            </Button>
          )}
          {r.status === "pending" && (
            <Button
              variant="outline"
              className="h-10"
              disabled={busy}
              onClick={() => run(() => setStatus({ kingdom: r.number, status: "rejected" }), `#${r.number} rejected.`)}
            >
              <Ban data-icon="inline-start" />
              Reject
            </Button>
          )}
          {r.status === "approved" && (
            <Button
              variant="outline"
              className="h-10"
              disabled={busy}
              onClick={() => run(() => setStatus({ kingdom: r.number, status: "pending" }), `#${r.number} closed.`)}
            >
              <Undo2 data-icon="inline-start" />
              Close
            </Button>
          )}
          {r.status === "rejected" && (
            <Badge variant="secondary" className="h-10 gap-1 px-3">
              <Ban className="size-3.5" />
              Rejected
            </Badge>
          )}
          <ConfirmButton
            title={`Delete kingdom #${r.number}?`}
            description={`Deletes the kingdom, its ${r.players} players and all turns. Its number can be set up again. This cannot be undone.`}
            actionLabel="Delete kingdom"
            className="h-10"
            onConfirm={() => run(() => remove({ kingdom: r.number }), `#${r.number} deleted.`)}
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </ConfirmButton>
        </div>
      </CardContent>
    </Card>
  );
}
