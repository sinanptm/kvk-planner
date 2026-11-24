"use client";

import { Copy, ExternalLink, Gift, MapPin, MessageCircle, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { copyText } from "@/lib/client";

// Where donations go: the developer's own character in Kingshot.
const DEV = { id: "372399873", kingdom: 2323, x: 690, y: 451 };
const STORE_URL = "https://store.centurygames.com";

export function Support() {
  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="Keep the tool free"
        description="Every kingdom can use it for free. If it saves your kingdom time, you can say thanks with a pack in the game."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gift className="size-5 text-primary" />
            Send a pack to my character
          </CardTitle>
          <CardDescription>Use the details below in the official Kingshot store.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Detail label="Player ID" value={DEV.id} copy />
          <Detail label="Kingdom" value={`#${DEV.kingdom}`} />
          <Detail label="Location" value={`X:${DEV.x} Y:${DEV.y}`} icon={MapPin} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How to do it</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-4">
            <Step n={1} icon={ShoppingBag}>
              Open the official Century Games store at{" "}
              <a
                href={STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4"
              >
                store.centurygames.com
                <ExternalLink className="size-3.5" />
              </a>{" "}
              and pick Kingshot.
            </Step>
            <Step n={2} icon={Gift}>
              Enter my player ID <span className="font-mono font-semibold">{DEV.id}</span> and check that the store
              shows kingdom #{DEV.kingdom} before you pay. Choose any pack you like.
            </Step>
            <Step n={3} icon={MessageCircle}>
              The store asks for a verification code that is sent to my in-game mail. Message me in the game (kingdom
              #{DEV.kingdom}, X:{DEV.x} Y:{DEV.y}) and I&apos;ll send you the code.
            </Step>
          </ol>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Never give anyone your own password or login. This tool will never ask for it, and payments only happen in the
        official store.
      </p>
    </>
  );
}

function Detail({ label, value, copy, icon: Icon }: { label: string; value: string; copy?: boolean; icon?: typeof MapPin }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-muted p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 font-mono text-lg font-semibold">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        {value}
        {copy && (
          <button
            type="button"
            aria-label={`Copy ${label}`}
            onClick={() => copyText(value, `${label} copied`)}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <Copy className="size-4" />
          </button>
        )}
      </span>
    </div>
  );
}

function Step({ n, icon: Icon, children }: { n: number; icon: typeof Gift; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {n}
      </span>
      <p className="flex-1 pt-1 text-sm">
        <Icon className="mr-1.5 inline size-4 align-[-3px] text-muted-foreground" />
        {children}
      </p>
    </li>
  );
}
