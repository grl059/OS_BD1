"use client";

import Link from "next/link";
import type { Level } from "@/lib/levels";
import { nextLevel } from "@/lib/levels";
import { useRun } from "@/lib/use-run";
import { Stage } from "@/components/stage";
import { EventLog } from "@/components/event-log";
import { Quiz } from "@/components/quiz";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export function Tutorial({ level }: { level: Level }) {
  const { events, state, running, runScript } = useRun();
  const next = nextLevel(level.id);

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

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Жишээ скрипт</span>
          <Button size="sm" onClick={() => runScript(level.script)} disabled={running}>
            <Play className="size-3.5" /> Ажиллуулах
          </Button>
        </div>
        <pre className="mb-3 overflow-x-auto rounded bg-muted p-2 text-xs">{level.script}</pre>
        {state ? (
          <Stage structure={level.structure} state={state} hot={events.length ? events[events.length - 1].hot : null} />
        ) : (
          <p className="text-sm text-muted-foreground">Дээрх товчийг дарж жишээг ажиллуулж үзээрэй.</p>
        )}
        {events.length > 0 && (
          <div className="mt-3">
            <EventLog events={events} />
          </div>
        )}
      </div>

      <Quiz quiz={level.quiz} />

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
    </div>
  );
}
