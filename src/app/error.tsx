"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Shown instead of a blank "This page couldn't load" if something on a page crashes.
// A sign-up in progress is saved in the browser, so trying again doesn't lose it.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-lg font-semibold">Something went wrong</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Your answers so far are saved. Tap below to continue where you left off.
      </p>
      <Button
        className="h-11 px-6"
        onClick={() => {
          reset();
          window.location.reload();
        }}
      >
        <RotateCcw data-icon="inline-start" />
        Try again
      </Button>
    </div>
  );
}
