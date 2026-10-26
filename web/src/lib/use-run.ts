"use client";

/**
 * Client-side hook for /play: keeps the whole accumulated script as state
 * and re-POSTs it in full to /api/run on every command, reading back the
 * ndjson stream and folding it into { events, state, errors }. No kds
 * logic is duplicated here - this only parses what the C core already
 * said (see lib/model.ts).
 *
 * This is a deliberate departure from a persistent-session design: `kds`
 * runs a whole script in well under a millisecond, so there is no
 * performance reason to keep a long-lived server-side process per user,
 * and re-running from scratch means the server needs no session state at
 * all - closing a tab or losing the connection loses nothing that a
 * re-POST of the same script can't rebuild.
 */
import { useCallback, useRef, useState } from "react";
import { parseLine, fold, type KdsLine, type RunResult } from "./model";

export interface UseRunState extends RunResult {
  running: boolean;
  fatalError: string | null;
}

const EMPTY: RunResult = { events: [], state: null, steps: 0, errors: [] };

export function useRun() {
  const [script, setScript] = useState<string>("");
  const [result, setResult] = useState<UseRunState>({ ...EMPTY, running: false, fatalError: null });
  const abortRef = useRef<AbortController | null>(null);

  const runScript = useCallback(async (nextScript: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setScript(nextScript);
    setResult((r) => ({ ...r, running: true, fatalError: null }));

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: nextScript }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        setResult({ ...EMPTY, running: false, fatalError: text || `HTTP ${res.status}` });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const lines: KdsLine[] = [];
      let fatal: string | null = null;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          const trimmed = raw.trim();
          if (!trimmed) continue;
          try {
            const parsed = parseLine(trimmed);
            if (parsed.type === "end" && "fatal" in parsed && typeof parsed.fatal === "string") {
              fatal = parsed.fatal;
            } else {
              lines.push(parsed);
            }
          } catch {
            // A malformed line means a core/web mismatch, not a user
            // mistake; surface it rather than silently dropping it.
            fatal = `malformed event line: ${trimmed.slice(0, 200)}`;
          }
          setResult({ ...fold(lines), running: true, fatalError: fatal });
        }
      }
      setResult({ ...fold(lines), running: false, fatalError: fatal });
    } catch (err) {
      if (controller.signal.aborted) return; // superseded by a newer run
      setResult({ ...EMPTY, running: false, fatalError: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  /** Appends one command line to the script and re-runs the whole thing. */
  const runCommand = useCallback(
    (line: string) => {
      const next = script ? `${script}\n${line}` : line;
      return runScript(next);
    },
    [script, runScript],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setScript("");
    setResult({ ...EMPTY, running: false, fatalError: null });
  }, []);

  return { script, ...result, runScript, runCommand, reset };
}
