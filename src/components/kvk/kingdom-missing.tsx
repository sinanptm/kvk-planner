"use client";

import { MapPinOff } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Shown for /<number> when that kingdom hasn't been set up (or the number isn't a kingdom).
export function KingdomMissing({ number }: { number: number | null }) {
  return (
    <Card className="mx-auto w-full max-w-md text-center">
      <CardHeader className="items-center">
        <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <MapPinOff className="size-6" />
        </span>
        <CardTitle className="text-xl">
          {number === null ? "Page not found" : `Kingdom #${number} isn’t set up yet`}
        </CardTitle>
        <CardDescription>
          {number === null
            ? "Check the link, or pick your kingdom on the main page."
            : "Ask your King or R4 for the right link. Are you the leader? Set your kingdom up in a minute."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {number !== null && (
          <Link href="/account" className={cn(buttonVariants(), "h-11 text-base")}>
            Set up kingdom #{number}
          </Link>
        )}
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
          Main page
        </Link>
      </CardContent>
    </Card>
  );
}
