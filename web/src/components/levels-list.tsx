import Link from "next/link";
import { LEVELS } from "@/lib/levels";
import { cn } from "@/lib/utils";

export function LevelsList({ base = "/learn", activeId }: { base?: string; activeId?: string }) {
  return (
    <ol className="flex flex-col gap-2">
      {LEVELS.map((l) => (
        <li key={l.id}>
          <Link
            href={`${base}?level=${l.id}`}
            className={cn(
              "flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary",
              activeId === l.id && "border-primary bg-accent",
            )}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {l.order}
            </span>
            <span className="font-medium">{l.title}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
