"use client";

import { useState } from "react";
import { STRUCTURE_ORDER, STRUCTURE_SPECS, type OpSpec } from "@/lib/config";
import type { StructureName } from "@/lib/model";
import { useRun } from "@/lib/use-run";
import { Stage } from "@/components/stage";
import { EventLog } from "@/components/event-log";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Play, RotateCcw, X } from "lucide-react";

/**
 * Free-play page: pick a structure, fill in a small friendly form (no
 * syntax to memorize) or run a one-click demo, and watch the real C core
 * run it. Everything a button or field produces is still just a plain
 * `kds` command line, handed to the same `runCommand`/`runScript` the
 * advanced box below uses - nothing here recomputes what the structure
 * looks like afterward, that always comes back from the C core.
 */
export function Simulator({ initialStructure = "list" as StructureName }) {
  const [structure, setStructure] = useState<StructureName>(initialStructure);
  const [activeOp, setActiveOp] = useState<OpSpec | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [advancedLine, setAdvancedLine] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { events, state, running, fatalError, runCommand, runScript, reset } = useRun();

  const spec = STRUCTURE_SPECS[structure];

  const pickStructure = (next: StructureName) => {
    setStructure(next);
    setActiveOp(null);
    setFieldValues({});
  };

  const pickOp = (op: OpSpec) => {
    setActiveOp(op);
    setFieldValues({});
    // select-type fields need a starting value so the dropdown isn't blank
    const initial: Record<string, string> = {};
    for (const f of op.fields) if (f.kind === "select") initial[f.key] = f.options?.[0]?.value ?? "";
    setFieldValues(initial);
  };

  const runOp = () => {
    if (!activeOp) return;
    runCommand(`${activeOp.cmdWord} ${activeOp.build(fieldValues)}`);
    setActiveOp(null);
    setFieldValues({});
  };

  const fieldsReady = activeOp ? activeOp.fields.every((f) => (fieldValues[f.key] ?? "").trim() !== "") : false;

  const submitAdvanced = () => {
    const trimmed = advancedLine.trim();
    if (!trimmed) return;
    runCommand(trimmed);
    setAdvancedLine("");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-border bg-accent/40 p-3 text-xs text-foreground/80">
        <b>1.</b> Доороос нэг бүтэц сонго &nbsp;·&nbsp; <b>2.</b> «Жишээ үзүүл»-ийг дар эсвэл өөрөө товч дараад утгаа бич
        &nbsp;·&nbsp; <b>3.</b> «Юу болов?» хэсгээс үр дүнг унш
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="flex flex-col gap-1">
          <ToggleGroup
            type="single"
            value={structure}
            onValueChange={(v) => v && pickStructure(v as StructureName)}
            className="flex-col items-stretch"
          >
            {STRUCTURE_ORDER.map((id) => {
              const s = STRUCTURE_SPECS[id];
              return (
                <ToggleGroupItem key={id} value={id} className="justify-start gap-2">
                  <span className="text-base leading-none">{s.emoji}</span>
                  {s.nickname}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
            <RotateCcw className="size-3.5" /> Шинээр эхлэх
          </Button>
        </aside>

        <main className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <span className="text-xl leading-none">{spec.emoji}</span> {spec.nickname}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  техник нэр: {spec.title} ({spec.subtitle})
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => runScript(spec.demoScript)} disabled={running}>
                Жишээ үзүүл
              </Button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{spec.blurb}</p>

            <div className="mt-4 min-h-24">
              {state ? (
                <Stage
                  structure={structure}
                  state={state}
                  hot={events.length ? events[events.length - 1].hot : null}
                />
              ) : (
                <p className="text-sm text-muted-foreground">(хоосон - дээрх «Жишээ үзүүл»-ийг эсвэл доорх товчнуудыг ашиглаарай)</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {spec.ops.map((op) => (
              <button
                key={op.id}
                onClick={() => pickOp(op)}
                className="rounded-full border border-border bg-muted px-3 py-1.5 text-sm hover:border-primary hover:text-primary"
              >
                {op.verb}
              </button>
            ))}
          </div>

          {activeOp && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (fieldsReady) runOp();
              }}
              className="flex flex-wrap items-end gap-3 rounded-lg border border-primary/40 bg-accent/30 p-3"
            >
              <span className="text-sm font-medium">{activeOp.verb}</span>
              {activeOp.fields.map((f) => (
                <label key={f.key} className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {f.label}
                  {f.kind === "select" ? (
                    <select
                      value={fieldValues[f.key] ?? ""}
                      onChange={(e) => setFieldValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                    >
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.kind === "int" ? "number" : "text"}
                      min={f.min}
                      max={f.max}
                      placeholder={f.placeholder}
                      value={fieldValues[f.key] ?? ""}
                      onChange={(e) => setFieldValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  )}
                </label>
              ))}
              <Button type="submit" size="sm" disabled={!fieldsReady || running}>
                <Play className="size-3.5" /> Ажиллуулах
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setActiveOp(null)}>
                <X className="size-3.5" /> Болих
              </Button>
            </form>
          )}

          {fatalError && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Алдаа</AlertTitle>
              <AlertDescription>{fatalError}</AlertDescription>
            </Alert>
          )}

          <div>
            <h3 className="mb-1 text-sm font-medium">Юу болов?</h3>
            <EventLog events={events} />
          </div>

          <details className="rounded-lg border border-border p-3 text-sm" open={showAdvanced} onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer select-none font-medium text-muted-foreground">
              Ахисан түвшин: команд шууд бичих
            </summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitAdvanced();
              }}
              className="mt-3 flex gap-2"
            >
              <input
                value={advancedLine}
                onChange={(e) => setAdvancedLine(e.target.value)}
                placeholder={`жишээ нь: ${spec.ops[0].cmdWord} ${spec.ops[0].build(
                  Object.fromEntries(spec.ops[0].fields.map((f) => [f.key, f.placeholder ?? f.options?.[0]?.value ?? "1"])),
                )}`}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <Button type="submit" disabled={running}>
                <Play className="size-4" /> Ажиллуулах
              </Button>
            </form>
          </details>
        </main>
      </div>
    </div>
  );
}
