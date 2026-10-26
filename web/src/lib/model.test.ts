import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseLine,
  parseAll,
  fold,
  isHotIdx,
  isHotKey,
  isHotVal,
  isHotPid,
} from "./model.ts";

// A real capture from `./kds --json`, trimmed to a handful of lines that
// exercise every structure and both the ok=true and ok=false paths.
const SAMPLE = [
  '{"type":"start"}',
  '{"type":"event","t":0,"cmd":"list","op":"add_tail","args":["1","2","2020"],"ok":true,"msg":"OK list add_tail 1/2/2020 (size=1)","hot":{"idx":0},"state":{"list":{"size":1,"items":[[1,2,2020]]},"queue":{"size":0,"items":[]},"stack":{"size":0,"items":[]},"bitmap":{"n":32,"bits":[0,0]},"hash":{"n":8,"size":0,"buckets":[[],[],[],[],[],[],[],[]]},"tree":{"avl":false,"size":0,"height":0,"node":null},"sched":{"quantum":0,"time":0,"done":0,"running":null,"ready":[]}}}',
  '{"type":"event","t":1,"cmd":"hash","op":"put","args":["foo","bar"],"ok":true,"msg":"OK hash put foo -> bar (bucket=4, size=1)","hot":{"key":"foo"},"state":{"list":{"size":1,"items":[[1,2,2020]]},"queue":{"size":0,"items":[]},"stack":{"size":0,"items":[]},"bitmap":{"n":32,"bits":[0,0]},"hash":{"n":8,"size":1,"buckets":[[],[],[],[],[["foo","bar"]],[],[],[]]},"tree":{"avl":false,"size":0,"height":0,"node":null},"sched":{"quantum":0,"time":0,"done":0,"running":null,"ready":[]}}}',
  '{"type":"event","t":2,"cmd":"nope","op":"wat","args":[],"ok":false,"msg":"ERR unknown structure \'nope\'","hot":null,"state":{"list":{"size":1,"items":[[1,2,2020]]},"queue":{"size":0,"items":[]},"stack":{"size":0,"items":[]},"bitmap":{"n":32,"bits":[0,0]},"hash":{"n":8,"size":1,"buckets":[[],[],[],[],[["foo","bar"]],[],[],[]]},"tree":{"avl":false,"size":0,"height":0,"node":null},"sched":{"quantum":0,"time":0,"done":0,"running":null,"ready":[]}}}',
  '{"type":"end","steps":3}',
].join("\n");

test("parseLine: start/event/end all parse to the right shape", () => {
  assert.deepEqual(parseLine('{"type":"start"}'), { type: "start" });
  const end = parseLine('{"type":"end","steps":5}');
  assert.equal(end.type, "end");
  assert.equal((end as { steps: number }).steps, 5);
  const ev = parseLine(SAMPLE.split("\n")[1]);
  assert.equal(ev.type, "event");
});

test("parseLine: rejects an unknown type and empty input", () => {
  assert.throws(() => parseLine('{"type":"bogus"}'));
  assert.throws(() => parseLine(""));
  assert.throws(() => parseLine("   "));
});

test("fold: counts events, keeps the last state, and collects errors in order", () => {
  const lines = parseAll(SAMPLE);
  const r = fold(lines);
  assert.equal(r.events.length, 3);
  assert.equal(r.steps, 3);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].cmd, "nope");
  // state is from the LAST event (the failed one), not re-derived by us -
  // it must still show the hash put from event 1, proving ok:false events
  // still carry a full, current snapshot.
  assert.equal(r.state?.hash.size, 1);
  assert.equal(r.state?.list.size, 1);
});

test("hot-locator predicates only match their own shape and value", () => {
  assert.equal(isHotIdx({ idx: 3 }, 3), true);
  assert.equal(isHotIdx({ idx: 3 }, 4), false);
  assert.equal(isHotIdx(null, 0), false);
  assert.equal(isHotIdx({ key: "x" }, 0), false); // wrong shape, not idx:0

  assert.equal(isHotKey({ key: "foo" }, "foo"), true);
  assert.equal(isHotKey({ key: "foo" }, "bar"), false);

  assert.equal(isHotVal({ val: 7 }, 7), true);
  assert.equal(isHotVal({ val: 7 }, 8), false);

  assert.equal(isHotPid({ pid: 1 }, 1), true);
  assert.equal(isHotPid({ pid: 1 }, 2), false);
});

test("parseAll round-trips a multi-line ndjson blob, ignoring blank lines", () => {
  const withBlanks = `\n${SAMPLE}\n\n`;
  const lines = parseAll(withBlanks);
  assert.equal(lines.length, 5); // start + 3 events + end
  assert.equal(lines[0].type, "start");
  assert.equal(lines[lines.length - 1].type, "end");
});
