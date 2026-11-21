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

/** The C core keeps at most 16 whitespace-separated words per line (cmd + op + 14 args). */
export const MAX_TOKENS = 16;

/**
 * Why a run stopped. `detail` is the technical string (shown when nothing
 * better is known); `notice` is a ready Mongolian sentence the API already
 * wrote for the user, used instead of the generic crash wording.
 */
export interface Fatal {
  detail: string;
  notice: string | null;
}

/** Mongolian, beginner-facing wording for a core/transport failure. */
function friendlyFatal(detail: string, rolledBack: boolean): string {
  const tail = rolledBack
    ? "Сүүлчийн команд буцаагдаж, өмнөх төлөв сэргээгдлээ — дараагийн командыг үргэлжлүүлэн өгч болно."
    : "«Шинээр эхлэх» дарж дахин оролдоно уу.";
  return `Програм алдаатай команд хүлээн авлаа. ${tail} (Техникийн мэдээлэл: ${detail})`;
}

export function useRun() {
  const [script, setScript] = useState<string>("");
  const [result, setResult] = useState<UseRunState>({ ...EMPTY, running: false, fatalError: null });
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Runs the whole script against the C core. Resolves to `null` when the run
   * finished normally (ERR lines from the core are normal events, not failures)
   * and to a Fatal when the core itself crashed or the request was refused -
   * the caller decides whether to roll the script back.
   */
  const runScript = useCallback(async (nextScript: string): Promise<Fatal | null> => {
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
        let detail = text || `HTTP ${res.status}`;
        let notice: string | null = null;
        // The API answers size/format refusals with a Mongolian userMessage;
        // a non-JSON body (an HTML error page) is shown as-is.
        try {
          const parsed = JSON.parse(text) as { userMessage?: unknown; error?: unknown };
          if (typeof parsed.userMessage === "string") {
            notice = parsed.userMessage;
            detail = parsed.userMessage;
          } else if (typeof parsed.error === "string") {
            detail = parsed.error;
          }
        } catch {
          /* keep the raw text */
        }
        setResult({ ...EMPTY, running: false, fatalError: detail });
        return { detail, notice };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const lines: KdsLine[] = [];
      let fatal: Fatal | null = null;

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
              fatal = { detail: parsed.fatal, notice: null };
            } else {
              lines.push(parsed);
            }
          } catch {
            // A malformed line means a core/web mismatch, not a user
            // mistake; surface it rather than silently dropping it.
            fatal = { detail: `malformed event line: ${trimmed.slice(0, 200)}`, notice: null };
          }
          setResult({ ...fold(lines), running: true, fatalError: fatal?.detail ?? null });
        }
      }
      setResult({ ...fold(lines), running: false, fatalError: fatal?.detail ?? null });
      return fatal;
    } catch (err) {
      if (controller.signal.aborted) return null; // superseded by a newer run
      const detail = err instanceof Error ? err.message : String(err);
      setResult({ ...EMPTY, running: false, fatalError: detail });
      return { detail, notice: null };
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setScript("");
    setResult({ ...EMPTY, running: false, fatalError: null });
  }, []);

  /**
   * Appends one command line to the script and re-runs the whole thing.
   * If the core faults on the new line, the line is dropped from the script
   * again and the previous (good) script is re-run, so one bad command can
   * never poison every later command (the script is replayed in full each time).
   */
  const runCommand = useCallback(
    async (line: string) => {
      if (line.trim().split(/\s+/).length > MAX_TOKENS) {
        setResult((r) => ({
          ...r,
          fatalError: `Команд хэт урт байна: нэг мөрөнд хамгийн ихдээ ${MAX_TOKENS} үг (команд, үйлдэл + 14 утга) байж болно. Мөрийг богиносгоод дахин оролдоно уу.`,
        }));
        return;
      }
      const next = script ? `${script}\n${line}` : line;
      const fatal = await runScript(next);
      if (fatal === null) return;
      if (script) await runScript(script);
      else reset();
      setResult((r) => ({ ...r, fatalError: fatal.notice ?? friendlyFatal(fatal.detail, true) }));
    },
    [script, runScript, reset],
  );


  return { script, ...result, runScript, runCommand, reset };
}
