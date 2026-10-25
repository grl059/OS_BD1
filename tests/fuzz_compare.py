"""Random differential test: the C program and the UI engine must agree.

Generates random command scripts (valid commands, bad dates, huge indexes,
too many processes, hash collisions, wrong argument counts ...), runs them
through ./kds and through the UI engine extracted from docs/ui/index.html,
and compares the output line by line.  Even seeds switch the tree to AVL.

    python3 tests/fuzz_compare.py [SEEDS] [COMMANDS]     (default 8 5000)
"""
import os
import random
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tests'))
import ui_engine  # noqa: E402

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


def main():
    seeds = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 5000
    kds = os.path.join(ROOT, 'kds')
    if not os.path.exists(kds):
        sys.exit('ERR: ./kds not found, run make first')
    fail = 0
    with tempfile.TemporaryDirectory() as tmp:
        js = os.path.join(tmp, 'engine.js')
        ui_engine.build(js)
        for seed in range(1, seeds + 1):
            r = random.Random(seed)
            lines = (['tree mode avl'] if seed % 2 == 0 else []) + [command(r) for _ in range(n)]
            script = '\n'.join(lines) + '\n'
            c = subprocess.run([kds], input=script, capture_output=True, text=True).stdout.splitlines()
            u = subprocess.run(['node', js], input=script, capture_output=True, text=True).stdout.splitlines()
            bad = next((i for i, (a, b) in enumerate(zip(c, u)) if a != b), None)
            if bad is None and len(c) == len(u):
                print(f'PASS fuzz seed={seed} ({n} commands{", avl" if seed % 2 == 0 else ""}, {len(c)} output lines)')
            else:
                fail = 1
                i = bad if bad is not None else min(len(c), len(u))
                print(f'FAIL fuzz seed={seed} at output line {i + 1}')
                print('  C : ' + (c[i] if i < len(c) else '<none>'))
                print('  UI: ' + (u[i] if i < len(u) else '<none>'))
    sys.exit(fail)


if __name__ == '__main__':
    main()
