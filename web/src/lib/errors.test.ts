import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { explainErr } from "./config.ts";
import { parseAll, eventsOf } from "./model.ts";

const KDS = path.join(import.meta.dirname, "..", "..", "..", "kds");

function run(script: string) {
  const p = spawnSync(KDS, ["--json"], { input: script, encoding: "utf8" });
  assert.equal(p.status, 0, `kds exited ${p.status}: ${p.stderr}`);
  return eventsOf(parseAll(p.stdout));
}

test("explainErr: non-errors give null, every ERR gives a Mongolian reason", () => {
  assert.equal(explainErr("OK list clear (size=0)"), null);
  assert.match(explainErr("ERR list: day out of range for month")!, /Тухайн сард/);
  assert.match(explainErr("ERR too many tokens (max 14 arguments)")!, /16 үг/);
  assert.match(explainErr("ERR queue: integer out of range -2147483647..2147483647 (got '99999999999')")!, /хэт том/);
  assert.match(explainErr("ERR proc: too many processes (limit 8)")!, /8/);
  assert.ok(explainErr("ERR something new")!.length > 0, "unknown ERR still gets a generic hint");
});

test("every ERR message the C core prints in examples/errors.txt gets an explanation", () => {
  const script = [
    "list add_tail 31 4 2000", "list add_tail 1 13 2000", "list add_tail 0/5/2000", "list add_tail abc",
    "list del 1 1 2000", "frob add", "queue pop", "queue push x", "bitmap size 0", "bitmap set 99",
    "tree insert 5", "tree insert 5", "tree delete 9", "queue push 99999999999", "proc new X 0", "sched policy rr 0",
  ].join("\n");
  const errs = run(script).filter((e) => !e.ok);
  assert.ok(errs.length >= 14);
  for (const e of errs) assert.ok(explainErr(e.msg), e.msg);
});

test("17+ tokens: the core answers with an ERR event instead of reading past its token array", () => {
  const long = "list add_tail " + Array.from({ length: 30 }, () => "1").join(" ");
  const ev = run(`${long}\nlist print`);
  assert.equal(ev.length, 2);
  assert.equal(ev[0].ok, false);
  assert.match(ev[0].msg, /too many tokens/);
  assert.equal(ev[1].ok, true, "the next valid command still works");
});

test("sched stats: 5.00 (RR q=2) and 4.33 (FCFS) average waiting time come from the core state", () => {
  const ticks = Array(11).fill("sched tick").join("\n");
  const rr = run(`sched policy rr 2\nproc new A 5\nproc new B 3\nproc new C 2\n${ticks}\nsched stats`);
  const s = rr[rr.length - 1].state.sched;
  assert.equal(s.done, 3);
  assert.equal(((s.wait_total ?? 0) / s.done).toFixed(2), "5.00");
  assert.match(rr[rr.length - 1].msg, /avg_wait=5\.00/);
  const fc = run(`sched policy fcfs\nproc new A 5\nproc new B 3\nproc new C 2\n${ticks}\nsched stats`);
  assert.match(fc[fc.length - 1].msg, /avg_wait=4\.33/);
});
