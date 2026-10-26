import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEVELS, levelById, nextLevel } from "./levels.ts";
import { STRUCTURE_SPECS } from "./config.ts";
import { parseAll, fold } from "./model.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// web/src/lib -> web -> app (repo root for this working copy, where `kds` is built)
const KDS_BIN = path.join(__dirname, "..", "..", "..", "kds");

test("levels: exactly one per structure, orders are 1..N with no gaps", () => {
  assert.equal(LEVELS.length, Object.keys(STRUCTURE_SPECS).length);
  const orders = LEVELS.map((l) => l.order).sort((a, b) => a - b);
  assert.deepEqual(orders, LEVELS.map((_, i) => i + 1));
  const structures = new Set(LEVELS.map((l) => l.structure));
  assert.equal(structures.size, LEVELS.length);
  for (const l of LEVELS) {
    assert.ok(l.structure in STRUCTURE_SPECS, `${l.id}: unknown structure ${l.structure}`);
  }
});

test("levels: quiz correctIndex is a valid index into choices", () => {
  for (const l of LEVELS) {
    assert.ok(l.quiz.correctIndex >= 0 && l.quiz.correctIndex < l.quiz.choices.length, l.id);
    assert.ok(l.quiz.choices.length >= 2, l.id);
  }
});

test("levelById / nextLevel walk the sequence in order", () => {
  assert.equal(levelById("list")?.order, 1);
  assert.equal(levelById("bogus"), undefined);
  assert.equal(nextLevel("list")?.id, "queue");
  assert.equal(nextLevel(LEVELS[LEVELS.length - 1].id), undefined);
});

test("every level's demo script actually runs clean against the real C core", () => {
  for (const l of LEVELS) {
    const out = execFileSync(KDS_BIN, ["--json"], { input: l.script, encoding: "utf8" });
    const lines = parseAll(out);
    const r = fold(lines);
    assert.equal(
      r.errors.length,
      0,
      `${l.id}: tutorial script produced ERR(s): ${r.errors.map((e) => e.msg).join("; ")}`,
    );
    assert.ok(r.events.length > 0, `${l.id}: script produced no events`);
  }
});
