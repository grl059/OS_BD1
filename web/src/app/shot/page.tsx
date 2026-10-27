"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { parseAll, fold, type RunResult } from "@/lib/model";
import { Stage } from "@/components/stage";
import { STRUCTURE_SPECS } from "@/lib/config";
import type { StructureName } from "@/lib/model";

const EMPTY: RunResult = { events: [], state: null, steps: 0, errors: [] };

/**
 * Temporary utility page for capturing documentation screenshots: it runs a
 * fixed script through the real C core and renders the same card the app
 * shows, so report figures match the live UI. Not linked anywhere. Unlike
 * the interactive pages it waits for the whole response before rendering,
 * so headless captures never catch a half-streamed state.
 */
function Shot() {
  const params = useSearchParams();
  const structure = (params.get("structure") ?? "list") as StructureName;
  const script = params.get("script") ?? "";
  const [result, setResult] = useState<RunResult>(EMPTY);

  useEffect(() => {
    if (!script) return;
    let dead = false;
    fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script }),
    })
      .then((r) => r.text())
      .then((text) => {
        if (!dead) setResult(fold(parseAll(text)));
      });
    return () => {
      dead = true;
    };
  }, [script]);

  const spec = STRUCTURE_SPECS[structure];
  const last = result.events.length ? result.events[result.events.length - 1] : null;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl p-8">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <span className="text-xl leading-none">{spec.emoji}</span> {spec.nickname}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                техник нэр: {spec.title} ({spec.subtitle})
              </p>
            </div>
          </div>
          <div className="mt-3 border-t border-border pt-3">
            {result.state && <Stage structure={structure} state={result.state} hot={last?.hot ?? null} />}
          </div>
          {last && (
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              {last.cmd} {last.op} → {last.msg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShotPage() {
  return (
    <Suspense>
      <Shot />
    </Suspense>
  );
}
