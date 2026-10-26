"use client";

import type { ReactNode } from "react";
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
        <Row>
          {state.list.items.length === 0 && <Empty />}
          {state.list.items.map(([d, m, y], i) => (
            <Cell key={i} active={isHotIdx(hot, i)}>
              {d}/{m}/{y}
            </Cell>
          ))}
        </Row>
      );
    case "queue":
    case "stack":
      return (
        <Row>
          {state[structure].items.length === 0 && <Empty />}
          {state[structure].items.map((v, i) => (
            <Cell key={i} active={isHotIdx(hot, i)}>
              {v}
            </Cell>
          ))}
        </Row>
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
                isHotIdx(hot, i) && "hot-flash",
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
              <div className="flex flex-col gap-1">
                {chain.length === 0 && <span className="text-[11px] text-muted-foreground/60">—</span>}
                {chain.map(([k, v], i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded bg-muted px-2 py-0.5 text-xs font-mono",
                      isHotKey(hot, k) && "hot-flash",
                    )}
                  >
                    {k}:{v}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    case "tree":
      return state.tree.node ? (
        <div className="flex justify-center overflow-x-auto py-4">
          <TreeNodeView node={state.tree.node} hot={hot} />
        </div>
      ) : (
        <Empty />
      );
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
            <div className="mb-1 text-xs text-muted-foreground">ready ({state.sched.ready.length})</div>
            <Row>
              {state.sched.ready.length === 0 && <Empty />}
              {state.sched.ready.map((p) => (
                <Pcb key={p.pid} pid={p.pid} name={p.name} rem={p.rem} burst={p.burst} active={isHotPid(hot, p.pid)} />
              ))}
            </Row>
          </div>
          <div className="text-xs text-muted-foreground">
            time={state.sched.time} · done={state.sched.done} · quantum={state.sched.quantum || "fcfs"}
          </div>
        </div>
      );
  }
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

function Empty() {
  return <span className="text-sm text-muted-foreground/60">(хоосон)</span>;
}

function Cell({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-card px-3 py-1.5 text-sm font-mono shadow-sm",
        active && "hot-flash border-primary",
      )}
    >
      {children}
    </div>
  );
}

function Pcb({ pid, name, rem, burst, active }: { pid: number; name: string; rem: number; burst: number; active: boolean }) {
  const pct = burst > 0 ? Math.round(((burst - rem) / burst) * 100) : 0;
  return (
    <div className={cn("w-32 rounded-md border border-border bg-card p-2", active && "hot-flash border-primary")}>
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

function TreeNodeView({ node, hot }: { node: TreeNode; hot: HotLocator }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-full border border-border bg-card font-mono text-sm shadow-sm",
          isHotVal(hot, node.v) && "hot-flash border-primary",
        )}
      >
        {node.v}
      </div>
      {(node.l || node.r) && (
        <div className="mt-2 flex gap-6">
          <div className="flex flex-col items-center">{node.l ? <TreeNodeView node={node.l} hot={hot} /> : <Slot />}</div>
          <div className="flex flex-col items-center">{node.r ? <TreeNodeView node={node.r} hot={hot} /> : <Slot />}</div>
        </div>
      )}
    </div>
  );
}

function Slot() {
  return <div className="size-10" />;
}
