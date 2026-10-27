"use client";

import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { HotLocator, KdsState, StructureName, TreeNode } from "@/lib/model";
import { isHotIdx, isHotKey, isHotVal, isHotPid } from "@/lib/model";

/**
 * Renders the live state of exactly one structure, straight from the last
 * `state` object the C core sent - nothing here is computed from anything
 * else. `hot` only ever highlights what the just-run command actually
 * touched (see web/EVENT_FORMAT.md).
 */
export function Stage({ structure, state, hot }: { structure: StructureName; state: KdsState; hot: HotLocator }) {
  switch (structure) {
    case "list":
      return (
        <Seq
          items={state.list.items.map(([d, m, y]) => `${d}/${m}/${y}`)}
          hot={hot}
          double
          hint="head → tail · next/prev хоёр холбоост, дугуй (сүүлчийн элемент эхнийхтэй холбогдоно)"
        />
      );
    case "queue":
      return (
        <Seq
          items={state[structure].items.map(String)}
          hot={hot}
          hint="front → back · FIFO (tail-д нэмж, head-ээс авна)"
        />
      );
    case "stack":
      return (
        <Seq
          items={state[structure].items.map(String)}
          hot={hot}
          hint="top → · LIFO (head-д нэмж, head-ээс авна)"
        />
      );
    case "bitmap":
      return (
        <div className="flex flex-wrap gap-1">
          {state.bitmap.bits.slice(0, state.bitmap.n).map((b, i) => (
            <div
              key={i}
              className={cn(
                "flex size-8 items-center justify-center rounded border text-xs font-mono",
                b ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted",
                isHotIdx(hot, i) && "ring-2 ring-primary bg-accent text-accent-foreground",
              )}
              title={`bit ${i}`}
            >
              {b}
            </div>
          ))}
        </div>
      );
    case "hash":
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {state.hash.buckets.map((chain, b) => (
            <div key={b} className="rounded border border-border p-2">
              <div className="mb-1 text-[10px] text-muted-foreground">bucket {b}</div>
              <div className="flex flex-col items-start gap-0.5">
                {chain.length === 0 && <span className="text-[11px] text-muted-foreground/60">—</span>}
                {chain.map(([k, v], i) => (
                  <Fragment key={i}>
                    {i > 0 && <LinkArrow down />}
                    <div
                      className={cn(
                        "rounded bg-muted px-2 py-0.5 text-xs font-mono",
                        isHotKey(hot, k) && "ring-2 ring-primary bg-accent text-accent-foreground",
                      )}
                    >
                      {k}:{v}
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    case "tree":
      return state.tree.node ? <TreeGraph root={state.tree.node} hot={hot} /> : <Empty />;
    case "sched":
      return (
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 text-xs text-muted-foreground">running</div>
            {state.sched.running ? (
              <Pcb pid={state.sched.running.pid} name={state.sched.running.name} rem={state.sched.running.rem} burst={state.sched.running.burst} active={isHotPid(hot, state.sched.running.pid)} />
            ) : (
              <Empty />
            )}
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">ready ({state.sched.ready.length}) · head → tail</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {state.sched.ready.length === 0 && <Empty />}
              {state.sched.ready.map((p, i) => (
                <Fragment key={p.pid}>
                  {i > 0 && <LinkArrow />}
                  <Pcb pid={p.pid} name={p.name} rem={p.rem} burst={p.burst} active={isHotPid(hot, p.pid)} />
                </Fragment>
              ))}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            time={state.sched.time} · done={state.sched.done} · quantum={state.sched.quantum || "fcfs"}
          </div>
        </div>
      );
  }
}

function Seq({
  items,
  hot,
  double = false,
  hint,
}: {
  items: string[];
  hot: HotLocator;
  double?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {items.length === 0 && <Empty />}
        {items.map((label, i) => (
          <Fragment key={i}>
            {i > 0 && <LinkArrow double={double} />}
            <Cell active={isHotIdx(hot, i)}>{label}</Cell>
          </Fragment>
        ))}
      </div>
      {hint && items.length > 0 && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** One list_link between two nodes: `→` for next, plus `←` when the structure is doubly linked. */
function LinkArrow({ double = false, down = false }: { double?: boolean; down?: boolean }) {
  if (down) {
    return (
      <span className="text-xs leading-none text-muted-foreground" aria-label="next">
        ↓
      </span>
    );
  }
  return (
    <span
      className="flex flex-col items-center gap-0 text-xs leading-none text-muted-foreground"
      aria-label={double ? "next / prev" : "next"}
    >
      <span>→</span>
      {double && <span>←</span>}
    </span>
  );
}

function Empty() {
  return <span className="text-sm text-muted-foreground/60">(хоосон)</span>;
}

function Cell({ children, active }: { children: ReactNode; active: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-card px-3 py-1.5 text-sm font-mono shadow-sm",
        active && "border-primary bg-accent text-accent-foreground ring-2 ring-primary",
      )}
    >
      {children}
    </div>
  );
}

function Pcb({ pid, name, rem, burst, active }: { pid: number; name: string; rem: number; burst: number; active: boolean }) {
  const pct = burst > 0 ? Math.round(((burst - rem) / burst) * 100) : 0;
  return (
    <div className={cn("w-32 rounded-md border border-border bg-card p-2", active && "border-primary ring-2 ring-primary")}>
      <div className="flex justify-between text-xs font-mono">
        <span>P{pid}</span>
        <span>{name}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-muted">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">rem {rem}/{burst}</div>
    </div>
  );
}

type LaidOutNode = { v: number; x: number; y: number };

/** In-order x, depth y - the usual BST drawing. Edges are parent→child lines. */
function layoutTree(root: TreeNode) {
  const nodes: LaidOutNode[] = [];
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const pos = new Map<TreeNode, { x: number; y: number }>();
  const X_GAP = 48;
  const Y_GAP = 64;
  let order = 0;
  let maxDepth = 0;

  const inorder = (n: TreeNode | null, depth: number) => {
    if (!n) return;
    inorder(n.l, depth + 1);
    const p = { x: order++ * X_GAP + 24, y: depth * Y_GAP + 24 };
    pos.set(n, p);
    nodes.push({ v: n.v, x: p.x, y: p.y });
    maxDepth = Math.max(maxDepth, depth);
    inorder(n.r, depth + 1);
  };

  const walk = (n: TreeNode) => {
    const p = pos.get(n)!;
    for (const c of [n.l, n.r]) {
      if (!c) continue;
      const q = pos.get(c)!;
      edges.push({ x1: p.x, y1: p.y + 18, x2: q.x, y2: q.y - 18 });
      walk(c);
    }
  };

  inorder(root, 0);
  walk(root);
  return {
    nodes,
    edges,
    width: Math.max(nodes.length * X_GAP, 120),
    height: (maxDepth + 1) * Y_GAP,
  };
}

function TreeGraph({ root, hot }: { root: TreeNode; hot: HotLocator }) {
  const { nodes, edges, width, height } = layoutTree(root);
  return (
    <div className="flex justify-center overflow-x-auto py-2">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Binary search tree graph"
      >
        {edges.map((e, i) => (
          <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="var(--border)" strokeWidth={1.5} />
        ))}
        {nodes.map((n) => {
          const active = isHotVal(hot, n.v);
          return (
            <g key={`${n.v}-${n.x}`}>
              <circle
                cx={n.x}
                cy={n.y}
                r={18}
                fill={active ? "var(--hot)" : "var(--card)"}
                stroke={active ? "var(--primary)" : "var(--border)"}
                strokeWidth={active ? 3 : 1.5}
              />
              <text
                x={n.x}
                y={n.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fill="var(--foreground)"
              >
                {n.v}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
