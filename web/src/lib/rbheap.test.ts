import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { STRUCTURE_ORDER, STRUCTURE_SPECS } from "./config.ts";
import { STRUCTURES, parseAll, eventsOf, finalState, isHotVal } from "./model.ts";

const KDS = path.join(import.meta.dirname, "..", "..", "..", "kds");

function run(script: string) {
  const p = spawnSync(KDS, ["--json"], { input: script, encoding: "utf8" });
  assert.equal(p.status, 0, `kds exited ${p.status}: ${p.stderr}`);
  return parseAll(p.stdout);
}

test("web lists all 9 structures, each with a spec and a demo script", () => {
  assert.equal(STRUCTURES.length, 9);
  assert.deepEqual([...STRUCTURE_ORDER].sort(), [...STRUCTURES].sort());
  for (const id of ["rb", "heap"] as const) assert.ok(STRUCTURE_SPECS[id].ops.length >= 4);
});

test("rb demo: state has coloured nodes, root is black, rotations counted", () => {
  const lines = run(STRUCTURE_SPECS.rb.demoScript);
  const st = finalState(lines)!;
  assert.equal(st.rb.size, 6);
  assert.equal(st.rb.node!.c, "b");
  assert.ok(st.rb.rotations >= 1);
  assert.deepEqual(eventsOf(lines).filter((e) => !e.ok), []);
});

test("heap demo: min at the root; push highlights the value, peek the root", () => {
  const lines = run("heap push 5\nheap push 3\nheap push 8\nheap push 1\nheap peek\nheap pop\n");
  const ev = eventsOf(lines);
  assert.ok(isHotVal(ev[0].hot, 5));
  assert.deepEqual(ev[4].hot, { idx: 0 });
  assert.deepEqual(ev[5].state.heap.items[0], 3);
  assert.equal(ev[5].state.heap.size, 3);
});
