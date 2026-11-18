"use client";

import { cn } from "@/lib/utils";
import type { KdsEvent } from "@/lib/model";
import { explainErr } from "@/lib/config";

export function EventLog({ events }: { events: KdsEvent[] }) {
  return (
    <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-xs">
      {events.length === 0 && <p className="text-muted-foreground">Команд оруулаад эхлээрэй.</p>}
      {events.map((e) => (
        <div
          key={e.t}
          title={e.msg}
          className={cn(
            "flex items-start gap-2 rounded px-1.5 py-0.5",
            !e.ok && "bg-destructive/10 text-destructive",
            e === events[events.length - 1] && "hot-flash",
          )}
        >
          <span className="w-6 shrink-0 text-right text-muted-foreground">{e.t}</span>
          <span className="shrink-0 font-semibold">
            {e.cmd} {e.op}
          </span>
          <span className="min-w-0 break-words">
            {e.msg}
            {!e.ok && explainErr(e.msg) && (
              <span className="mt-0.5 block font-sans text-[11px] font-normal text-foreground/80">
                ↳ {explainErr(e.msg)}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
