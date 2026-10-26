"""Random differential test: `./kds` (text) and `./kds --json` must agree.

Replaces the old UI-vs-C fuzzer (tests/fuzz_compare.py, retired together
with docs/ui/index.html) now that there is no second hand-written engine to
compare against. What still needs proving is that `--json` is a faithful,
additive layer on top of the text output - so this generates the same kind
of random/adversarial command scripts the old fuzzer used (valid commands,
bad dates, huge indexes, too many processes, hash collisions, wrong
argument counts, unknown structures, blank/comment-only lines ...) and
checks, line by line, that every JSON event's "msg" is exactly the matching
text-mode output line, under ASan + UBSan.

    python3 tests/fuzz_json.py [SEEDS] [COMMANDS]     (default 8 5000)
"""
import json
import os
import random
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KDS = os.path.join(ROOT, 'kds')

NUM = lambda r: str(r.choice([r.randint(-3, 40), r.randint(-200, 200), r.randint(0, 9)]))
WORDS = ['a', 'b', 'ab', 'ba', 'bob', 'alice', 'key_1', 'x9', 'zed', 'too_long_key_name', 'bad-key', 'A']


def command(r):
    s = r.choice(['list', 'queue', 'stack', 'bitmap', 'hash', 'tree', 'proc', 'sched', 'junk'])
    if s == 'list':
        op = r.choice(['add_head', 'add_tail', 'del', 'find', 'del', 'print', 'clear', 'bogus'])
        if op in ('print', 'clear', 'bogus'):
            return f'list {op}'
        d, m = r.randint(0, 32), r.randint(0, 13)
        y = r.choice([1899, 1900, 1995, 2000, 2024, 2100, 2101])
        args = [str(d), str(m), str(y)]
        if r.random() < 0.1:
            args = args[:r.randint(0, 2)] + (['x'] if r.random() < 0.5 else [])
        return 'list ' + ' '.join([op] + args)
    if s in ('queue', 'stack'):
        op = r.choice(['push', 'push', 'pop', 'find', 'print', 'bogus'])
        if op in ('push', 'find'):
            return f'{s} {op} ' + (NUM(r) if r.random() > 0.1 else r.choice(['x', '', '1 2', '99999999999']))
        return f'{s} {op}'
    if s == 'bitmap':
        op = r.choice(['set', 'clear', 'test', 'set', 'print', 'size', 'bogus'])
        if op == 'size':
            return f'bitmap size {r.choice([0, 1, 8, 16, 32, 64, 128, 129])}'
        if op in ('set', 'clear', 'test'):
            return f'bitmap {op} {r.randint(-2, 130)}'
        return f'bitmap {op}'
    if s == 'hash':
        op = r.choice(['put', 'put', 'get', 'del', 'print', 'size', 'clear', 'bogus'])
        if op == 'put':
            return f'hash put {r.choice(WORDS)} {r.choice(WORDS[:8] + [NUM(r)])}'
        if op in ('get', 'del'):
            return f'hash {op} {r.choice(WORDS)}'
        if op == 'size':
            return f'hash size {r.randint(0, 17)}'
        return f'hash {op}'
    if s == 'tree':
        op = r.choice(['insert', 'insert', 'insert', 'delete', 'find', 'print', 'bogus'])
        if op in ('insert', 'delete', 'find'):
            return f'tree {op} {r.randint(-20, 60)}'
        return f'tree {op}'
    if s == 'proc':
        if r.random() < 0.1:
            return r.choice(['proc kill 1', 'proc new', 'proc new x'])
        return f'proc new {r.choice(["A", "job1", "p_2", "name_too_long", "x"])} {r.randint(0, 22)}'
    if s == 'sched':
        op = r.choice(['tick', 'tick', 'tick', 'print', 'policy', 'clear', 'bogus'])
        if op == 'policy':
            return r.choice(['sched policy fcfs', f'sched policy rr {r.randint(0, 11)}', 'sched policy lottery'])
        return f'sched {op}'
    return r.choice(['junk add', 'frob', '# comment only', '', '   '])


def run(args, script):
    p = subprocess.run([KDS, *args], input=script, capture_output=True, text=True)
    return p.returncode, p.stdout, p.stderr


def main():
    seeds = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 5000
    if not os.path.exists(KDS):
        sys.exit('ERR: ./kds not found, run make first')

    fail = 0
    for seed in range(1, seeds + 1):
        r = random.Random(seed)
        lines = (['tree mode avl'] if seed % 2 == 0 else []) + [command(r) for _ in range(n)]
        script = '\n'.join(lines) + '\n'

        rc_t, out_t, err_t = run([], script)
        rc_j, out_j, err_j = run(['--json'], script)

        if err_t.strip() or err_j.strip() or rc_t != 0 or rc_j != 0:
            fail = 1
            print(f'FAIL fuzz_json seed={seed}: rc={rc_t}/{rc_j} stderr_text={err_t[:300]!r} stderr_json={err_j[:300]!r}')
            continue

        text_lines = [l for l in out_t.split('\n') if l != '']
        json_lines = [l for l in out_j.split('\n') if l != '']
        events = []
        bad_json = None
        for i, l in enumerate(json_lines[1:-1]):
            try:
                events.append(json.loads(l))
            except Exception as e:
                bad_json = (i, l, e)
                break

        if bad_json is not None:
            fail = 1
            i, l, e = bad_json
            print(f'FAIL fuzz_json seed={seed}: malformed JSON at event {i}: {e} :: {l[:200]!r}')
            continue

        if len(events) != len(text_lines):
            fail = 1
            print(f'FAIL fuzz_json seed={seed}: {len(events)} json events vs {len(text_lines)} text lines')
            continue

        mismatch = next((i for i, (e, t) in enumerate(zip(events, text_lines)) if e['msg'] != t), None)
        if mismatch is not None:
            fail = 1
            print(f'FAIL fuzz_json seed={seed} at line {mismatch}')
            print('  text: ' + text_lines[mismatch])
            print('  json: ' + events[mismatch]['msg'])
            continue

        print(f'PASS fuzz_json seed={seed} ({n} commands{", avl" if seed % 2 == 0 else ""}, {len(events)} events)')

    sys.exit(fail)


if __name__ == '__main__':
    main()
