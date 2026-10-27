"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Level } from "@/lib/levels";
import { nextLevel } from "@/lib/levels";
import { useRun } from "@/lib/use-run";
import { Stage } from "@/components/stage";
import { Quiz } from "@/components/quiz";
import { markLevelDone } from "@/components/levels-list";
import { Button } from "@/components/ui/button";
import { Check, FastForward, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Guided walkthrough for one /learn level: a tutor speaks one line per step,
 * the learner runs exactly one command at a time against the real C core,
 * watches the state change, and only then moves on. Each step re-runs the
 * script prefix through /api/run, so the state on screen is always what the
 * C core itself reported for the commands executed so far.
 */
export function Tutorial({ level }: { level: Level }) {
  const { events, state, running, runScript, reset } = useRun();
  const [current, setCurrent] = useState(0); // index of the next step to run
  const next = nextLevel(level.id);
  const steps = level.steps;
  const total = steps.length;
  const allDone = current >= total;
  const lastEvent = events.length ? events[events.length - 1] : null;

  useEffect(() => {
    if (allDone) markLevelDone(level.id);
  }, [allDone, level.id]);

  const runStep = async () => {
    if (current >= total) return;
    const prefix = steps
      .slice(0, current + 1)
      .map((s) => s.cmd)
      .join("\n");
    await runScript(prefix);
    setCurrent(current + 1);
  };

  const runAll = () => {
    runScript(level.script);
    setCurrent(total);
  };

  const restart = () => {
    reset();
    setCurrent(0);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">{level.title}</h1>
        <div className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-foreground/90">
          {level.narration.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Алхам {Math.min(current + 1, total)}/{total}
          </span>
          {lastEvent && (
            <span className={cn("font-mono", !lastEvent.ok && "text-destructive")}>
              {lastEvent.cmd} {lastEvent.op} → {lastEvent.msg}
            </span>
          )}
        </div>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${(Math.min(current, total) / total) * 100}%` }}
          />
        </div>
        {state ? (
          <Stage structure={level.structure} state={state} hot={lastEvent?.hot ?? null} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Доорх алхамуудаас нэг нэгээр команд ажилуулж бүтцийг амилуулъя.
          </p>
        )}
      </div>

      <ol className="relative flex flex-col gap-0 border-l-2 border-border pl-6">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const result = done ? events[i] : undefined;
          return (
            <li key={i} className="relative pb-6 last:pb-0">
              <span
                className={cn(
                  "absolute -left-[31px] flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary bg-card text-primary ring-4 ring-primary/20",
                  !done && !active && "border-border bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>

              {active && (
                <div className="anim-fade-up rounded-xl border border-primary/30 bg-accent/30 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-lg text-primary-foreground shadow-sm">
                      🧑‍🏫
                    </span>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">Багш</div>
                      <p className="mt-0.5 text-sm leading-relaxed">{step.say}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <code className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs">
                      {step.cmd}
                    </code>
                    <Button size="sm" onClick={runStep} disabled={running}>
                      <Play className="size-3.5" />
                      {running ? "Ажиллаж байна..." : "Энэ алхамыг ажиллуулах"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={runAll} disabled={running}>
                      <FastForward className="size-3.5" /> Бүх алхам
                    </Button>
                  </div>
                </div>
              )}

              {done && (
                <div className="anim-fade-up text-sm">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{step.cmd}</code>
                  {result && (
                    <span className={cn("ml-2 text-xs", !result.ok ? "text-destructive" : "text-muted-foreground")}>
                      {result.ok ? result.msg : `АЛДАА: ${result.msg}`}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={restart} disabled={running || current === 0}>
          <RotateCcw className="size-3.5" /> Эхнээс нь дахих
        </Button>
        {allDone && (
          <span className="anim-pop rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            Бүх алхам ажиллалаа
          </span>
        )}
      </div>

      {allDone && (
        <div className="anim-fade-up">
          <Quiz quiz={level.quiz} />
        </div>
      )}

      {allDone && (
        <div className="flex justify-end">
          {next ? (
            <Link href={`/learn?level=${next.id}`}>
              <Button variant="secondary">Дараагийн шат →</Button>
            </Link>
          ) : (
            <Link href="/play">
              <Button variant="secondary">Чөлөөт горимд шилжих →</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
