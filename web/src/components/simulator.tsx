"use client";

import { useState } from "react";
import { PROC_NEW, STRUCTURE_ORDER, STRUCTURE_SPECS } from "@/lib/config";
import type { StructureName } from "@/lib/model";
import { useRun } from "@/lib/use-run";
import { Stage } from "@/components/stage";
import { EventLog } from "@/components/event-log";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Play, RotateCcw } from "lucide-react";

/** Free-play page: pick a structure, type a command, watch the real C core run it. */
export function Simulator({ initialStructure = "list" as StructureName }) {
  const [structure, setStructure] = useState<StructureName>(initialStructure);
  const [line, setLine] = useState("");
  const { events, state, running, fatalError, runCommand, reset } = useRun();

  const spec = STRUCTURE_SPECS[structure];
  // "sched" has two command words: `sched ...` (policy/tick/print/clear) and
  // `proc new ...` (creating a PCB) - both are shown as quick-fill chips.
  const chips =
    structure === "sched"
      ? [{ cmdWord: "proc", ...PROC_NEW }, ...spec.ops.map((o) => ({ cmdWord: "sched", ...o }))]
      : spec.ops.map((o) => ({ cmdWord: structure, ...o }));

  const submit = () => {
    const trimmed = line.trim();
    if (!trimmed) return;
    runCommand(trimmed);
    setLine("");
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="flex flex-col gap-1">
        <ToggleGroup
          type="single"
          value={structure}
          onValueChange={(v) => v && setStructure(v as StructureName)}
          className="flex-col items-stretch"
        >
          {STRUCTURE_ORDER.map((id) => (
            <ToggleGroupItem key={id} value={id} className="justify-start">
              {STRUCTURE_SPECS[id].title}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
          <RotateCcw className="size-3.5" /> Шинээр эхлэх
        </Button>
      </aside>

      <main className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold">{spec.title}</h2>
          <p className="text-xs text-muted-foreground">
            {spec.subtitle} · {spec.kernelRef}
          </p>
          <div className="mt-4 min-h-24">
            {state ? (
              <Stage
                structure={structure}
                state={state}
                hot={events.length ? events[events.length - 1].hot : null}
              />
            ) : (
              <p className="text-sm text-muted-foreground">(хоосон, команд оруулаад эхлээрэй)</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={`${c.cmdWord}-${c.op}`}
              onClick={() => setLine(`${c.cmdWord} ${c.usage.split(" ")[0]} `)}
              className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs hover:border-primary hover:text-primary"
              title={c.note}
            >
              {c.cmdWord} {c.usage}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex gap-2"
        >
          <input
            value={line}
            onChange={(e) => setLine(e.target.value)}
            placeholder={`жишээ нь: ${chips[0]?.cmdWord} ${chips[0]?.usage.replace(/<[^>]+>/g, "1")}`}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" disabled={running}>
            <Play className="size-4" /> Ажиллуулах
          </Button>
        </form>

        {fatalError && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Алдаа</AlertTitle>
            <AlertDescription>{fatalError}</AlertDescription>
          </Alert>
        )}

        <div>
          <h3 className="mb-1 text-sm font-medium">Түүх</h3>
          <EventLog events={events} />
        </div>
      </main>
    </div>
  );
}
