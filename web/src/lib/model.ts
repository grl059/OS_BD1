/**
 * TypeScript mirror of web/EVENT_FORMAT.md - the JSON one-line-per-command
 * protocol `./kds --json` writes to stdout. Nothing in this file computes
 * structure state; it only parses and re-shapes what the C core already
 * said, which is the whole point of the "screen only displays" design.
 */

export type HotLocator =
  | { idx: number }
  | { key: string }
  | { val: number }
  | { pid: number }
  | null;

export interface ListState {
  size: number;
  items: [number, number, number][]; // [day, month, year]
}

export interface SeqState {
  size: number;
  items: number[];
}

export interface BitmapState {
  n: number;
  bits: number[];
}

export interface HashState {
  n: number;
  size: number;
  buckets: [string, string][][];
}

export interface TreeNode {
  v: number;
  l: TreeNode | null;
  r: TreeNode | null;
}

export interface TreeState {
  avl: boolean;
  size: number;
  height: number;
  node: TreeNode | null;
}

export interface Pcb {
  pid: number;
  name: string;
  rem: number;
  burst: number;
}

export interface SchedState {
  quantum: number;
  time: number;
  done: number;
  running: Pcb | null;
  ready: Pcb[];
}

export interface KdsState {
  list: ListState;
  queue: SeqState;
  stack: SeqState;
  bitmap: BitmapState;
  hash: HashState;
  tree: TreeState;
  sched: SchedState;
}

export interface KdsEvent {
  type: "event";
  t: number;
  cmd: string;
  op: string;
  args: string[];
  ok: boolean;
  msg: string;
  hot: HotLocator;
  state: KdsState;
}

export interface KdsStart {
  type: "start";
}

export interface KdsEnd {
  type: "end";
  steps: number;
}

export type KdsLine = KdsStart | KdsEvent | KdsEnd;

/** The seven structure names, in the order every page lists them. */
export const STRUCTURES = [
  "list",
  "queue",
  "stack",
  "bitmap",
  "hash",
  "tree",
  "sched",
] as const;
export type StructureName = (typeof STRUCTURES)[number];

/**
 * Parses one line of `./kds --json` output. Throws on malformed JSON or a
 * line that isn't one of the three known shapes - callers decide whether
 * that should surface as a user-facing error (it would mean a core/web
 * version mismatch, not a user input mistake).
 */
export function parseLine(raw: string): KdsLine {
  const line = raw.trim();
  if (!line) throw new Error("empty line");
  const obj = JSON.parse(line) as Record<string, unknown>;
  switch (obj.type) {
    case "start":
      return { type: "start" };
    case "end":
      if (typeof obj.steps !== "number") throw new Error("end: missing steps");
      return { type: "end", steps: obj.steps };
    case "event":
      return obj as unknown as KdsEvent;
    default:
      throw new Error(`unknown line type ${String(obj.type)}`);
  }
}

/** Splits a raw ndjson blob (as returned by /api/run) into trimmed, non-empty lines. */
export function splitLines(blob: string): string[] {
  return blob.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

export function parseAll(blob: string): KdsLine[] {
  return splitLines(blob).map(parseLine);
}

/** Pulls just the KdsEvent entries out of a parsed line stream, in order. */
export function eventsOf(lines: KdsLine[]): KdsEvent[] {
  return lines.filter((l): l is KdsEvent => l.type === "event");
}

/** The state after the whole script ran, or null if the script produced no events. */
export function finalState(lines: KdsLine[]): KdsState | null {
  const events = eventsOf(lines);
  return events.length ? events[events.length - 1].state : null;
}

/** Everything the UI needs is one fold over a line stream. */
export interface RunResult {
  events: KdsEvent[];
  state: KdsState | null;
  steps: number;
  errors: KdsEvent[]; // events where ok === false, in order
}

export function fold(lines: KdsLine[]): RunResult {
  const events = eventsOf(lines);
  const end = lines.find((l): l is KdsEnd => l.type === "end");
  return {
    events,
    state: events.length ? events[events.length - 1].state : null,
    steps: end ? end.steps : events.length,
    errors: events.filter((e) => !e.ok),
  };
}

/** True when a bitmap/hash/tree/etc. hot locator refers to this list/queue/stack index. */
export function isHotIdx(hot: HotLocator, idx: number): boolean {
  return hot !== null && "idx" in hot && hot.idx === idx;
}

export function isHotKey(hot: HotLocator, key: string): boolean {
  return hot !== null && "key" in hot && hot.key === key;
}

export function isHotVal(hot: HotLocator, val: number): boolean {
  return hot !== null && "val" in hot && hot.val === val;
}

export function isHotPid(hot: HotLocator, pid: number): boolean {
  return hot !== null && "pid" in hot && hot.pid === pid;
}
