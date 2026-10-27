# `kds --json` event format

`./kds --json [script.txt]` reads the same command script as plain `./kds`
(one `<structure> <op> [args...]` per line, `#` comments, stdin when no file
is given) and, instead of the human-readable text, writes one JSON object
per line (newline-delimited JSON / ndjson) to stdout. Default (no `--json`)
output is byte-for-byte unchanged — this is a second, additive mode, not a
replacement, and no existing handler function was modified to add it.

Three kinds of line appear, all with a `"type"` field:

```
{"type":"start"}
{"type":"event", ...}        // one per executed command, see below
{"type":"end","steps":17}
```

## Event object

```json
{
  "type": "event",
  "t": 10,
  "cmd": "sched",
  "op": "tick",
  "args": [],
  "ok": true,
  "msg": "TICK t=0 P1(worker) remaining=3",
  "hot": {"pid": 1},
  "state": { "list": {...}, "queue": {...}, "stack": {...}, "bitmap": {...},
             "hash": {...}, "tree": {...}, "rb": {...}, "heap": {...},
             "sched": {...} }
}
```

| field  | meaning |
|--------|---------|
| `t`    | 0-based step index (one per input line that produced an event; blank lines and comment-only lines don't count) |
| `cmd`  | the structure name (`list`, `queue`, `stack`, `bitmap`, `hash`, `tree`, `rb`, `heap`, `proc`, `sched`), or the unrecognised token if the line named an unknown structure |
| `op`   | the requested operation, or `""` if the line had no second token |
| `args` | the raw argument tokens, as typed |
| `ok`   | `false` iff the message starts with `ERR` |
| `msg`  | exactly the line the equivalent non-`--json` run would have printed for this command (no trailing newline) |
| `hot`  | what the UI should highlight as a result of this one command, or `null` for nothing (see below) |
| `state`| a full snapshot of **all nine** structures, taken immediately after the command ran, straight from the same C globals the plain-text handlers already update |

`state` is sent in full on every event, not as a diff. The browser never
reconstructs or guesses state of its own — it only ever displays the last
`state` it received, exactly as the reference project's own UI philosophy
puts it: *the screen only displays; every bit of synchronization happens
inside the C program.*

### `state` shape

```json
"list":   {"size": 2, "items": [[1,2,2020],[3,4,2021]]}
"queue":  {"size": 1, "items": [5]}
"stack":  {"size": 1, "items": [9]}
"bitmap": {"n": 32, "bits": [0,0,0,1,0,...]}
"hash":   {"n": 8, "size": 1, "auto": false, "resizes": 0, "buckets": [[],[],[],[],[["foo","bar"]],[],[],[]]}
"rb":     {"size": 3, "height": 2, "rotations": 1, "node": {"v":20,"c":"b","l":{"v":10,"c":"r","l":null,"r":null},"r":{"v":30,"c":"r","l":null,"r":null}}}   // c = "r" | "b"
"heap":   {"size": 3, "items": [5,10,20]}   // array order (min-heap)
"tree":   {"avl": false, "size": 2, "height": 2,
           "node": {"v":7,"l":{"v":3,"l":null,"r":null},"r":null} }
"sched":  {"quantum": 2, "time": 2, "done": 0,
           "running": {"pid":1,"name":"worker","rem":2,"burst":4} | null,
           "ready": [{"pid":1,"name":"worker","rem":2,"burst":4}, ...]}
```

`queue.items` is front-first, `stack.items` is top-first — the same order
the text `print` command uses. `hash.buckets[i]` is bucket `i`'s chain,
head-to-tail, each entry `[key, value]`. `tree.node` is `null` for an empty
tree, otherwise a recursive `{v, l, r}` node (pre-order doesn't matter here;
the shape alone is enough to redraw the whole tree).

### `hot` by command

| cmd/op | hot |
|---|---|
| `list add_head` | `{"idx":0}` |
| `list add_tail` | `{"idx": size-1}` |
| `list find` (found) | `{"idx": <position>}` |
| `queue push` | `{"idx": size-1}` (tail) |
| `stack push` | `{"idx":0}` (top) |
| `queue/stack find` (found) | `{"idx": <position>}` |
| `bitmap set/clear/test` | `{"idx": <bit index>}` |
| `hash put` | `{"key": "<key>"}` |
| `rb insert`, `rb find` (found) | `{"val": <int>}` |
| `hash get` (found) | `{"key": "<key>"}` |
| `tree insert` | `{"val": <value>}` |
| `tree find` (found) | `{"val": <value>}` |
| `proc new` | `{"pid": <new pid>}` |
| `sched tick` (a process ran) | `{"pid": <that process's pid>}` |
| anything else, or `ok:false` | `null` |

## Why a full resend instead of a diff

`kds` executes a line in well under a millisecond and a script is at most a
few hundred lines, so there is no performance reason to diff. Resending the
full state keeps the browser's model trivial (one `state` object replaces
the last one) and keeps the guarantee above exact: nothing the user sees was
computed anywhere but inside `kds.c`.
