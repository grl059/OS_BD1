"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "@/lib/levels";
import { CheckCircle2, XCircle } from "lucide-react";

export function Quiz({ quiz }: { quiz: QuizQuestion }) {
  const [picked, setPicked] = useState<number | null>(null);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="font-medium">{quiz.question}</p>
      <div className="mt-3 flex flex-col gap-2">
        {quiz.choices.map((choice, i) => {
          const isPicked = picked === i;
          const isCorrect = i === quiz.correctIndex;
          return (
            <button
              key={i}
              onClick={() => setPicked(i)}
              disabled={picked !== null}
              className={cn(
                "flex items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm transition-colors",
                picked === null && "hover:border-primary hover:bg-accent",
                picked !== null && isCorrect && "border-primary bg-accent",
                picked !== null && isPicked && !isCorrect && "border-destructive/50 bg-destructive/10",
              )}
            >
              {choice}
              {picked !== null && isCorrect && <CheckCircle2 className="size-4 text-primary" />}
              {picked !== null && isPicked && !isCorrect && <XCircle className="size-4 text-destructive" />}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <p className="mt-3 text-sm text-muted-foreground">{quiz.explanation}</p>
      )}
    </div>
  );
}
