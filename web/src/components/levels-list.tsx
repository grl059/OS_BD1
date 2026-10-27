"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { LEVELS } from "@/lib/levels";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "kds-done-levels";

export function readDoneLevels(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Mark a level as completed (idempotent); called by the walkthrough when its last step runs. */
export function markLevelDone(id: string) {
  try {
    const cur = readDoneLevels();
    if (!cur.includes(id)) localStorage.setItem(STORAGE_KEY, JSON.stringify([...cur, id]));
  } catch {
    // private mode / disabled storage - progress just won't persist
  }
}

export function LevelsList({ base = "/learn", activeId }: { base?: string; activeId?: string }) {
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    setDone(readDoneLevels());
  }, []);

  return (
    <ol className="flex flex-col gap-2">
      {LEVELS.map((l) => {
        const isDone = done.includes(l.id);
        return (
          <li key={l.id}>
            <Link
              href={`${base}?level=${l.id}`}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary",
                activeId === l.id && "border-primary bg-accent",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  isDone
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                  activeId === l.id && !isDone && "bg-primary text-primary-foreground",
                )}
              >
                {isDone ? <Check className="size-3.5" /> : l.order}
              </span>
              <span className="font-medium">{l.title}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
