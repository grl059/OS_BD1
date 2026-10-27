#!/usr/bin/env python3
"""Red-black tree + min-heap invariant check (uses `./kds --json` state).

30 random runs: insert/delete random values in `rb`, then after every few
commands verify from the JSON snapshot that
  * the in-order values equal the sorted model set (BST order),
  * the root is black, no red node has a red child,
  * every root-to-leaf path has the same number of black nodes,
  * height <= 2 * log2(n + 1)  (the red-black bound).
The `heap` is checked the same way: heap property on the array, and popping
everything returns the values in sorted order.

    python3 tests/rb_check.py
"""
import json
import math
import os
import random
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KDS = os.path.join(ROOT, 'kds')


def events(lines):
    p = subprocess.run([KDS, '--json'], input='\n'.join(lines) + '\n', capture_output=True, text=True)
    assert not p.stderr.strip(), p.stderr
    return [json.loads(l) for l in p.stdout.splitlines() if '"event"' in l]


def inorder(n, out):
    if n:
        inorder(n['l'], out); out.append(n['v']); inorder(n['r'], out)


def check_rb(node, size):
    """-> error string or None"""
    if node is None:
        return None if size == 0 else 'empty tree but size != 0'
    if node['c'] != 'b':
        return 'root is red'

    def walk(n):
        if n is None:
            return 1, 0
        if n['c'] == 'r':
            for ch in (n['l'], n['r']):
                if ch and ch['c'] == 'r':
                    raise ValueError(f"red node {n['v']} has red child {ch['v']}")
        lb, lh = walk(n['l'])
        rb, rh = walk(n['r'])
        if lb != rb:
            raise ValueError(f"black height differs below {n['v']}: {lb} vs {rb}")
        return lb + (n['c'] == 'b'), 1 + max(lh, rh)

    try:
        _, h = walk(node)
    except ValueError as e:
        return str(e)
    if h > 2 * math.log2(size + 1) + 1e-9:
        return f'height {h} > 2*log2({size}+1)'
    return None


def main():
    if not os.path.exists(KDS):
        sys.exit('ERR: ./kds not found, run make first')
    fail = 0
    for seed in range(1, 31):
        r = random.Random(seed)
        model, lines = set(), []
        for _ in range(r.randint(50, 400)):
            v = r.randint(0, 300)
            if r.random() < 0.6:
                lines.append(f'rb insert {v}'); model.add(v)
            else:
                lines.append(f'rb delete {v}'); model.discard(v)
        # replay prefix-by-prefix is too slow; check every 10th event snapshot
        evs = events(lines)
        m, bad = set(), None
        for i, (ln, ev) in enumerate(zip(lines, evs)):
            op, v = ln.split()[1], int(ln.split()[2])
            if op == 'insert': m.add(v)
            else: m.discard(v)
            if i % 10 and i != len(lines) - 1:
                continue
            st = ev['state']['rb']
            vals = []
            inorder(st['node'], vals)
            if vals != sorted(m):
                bad = f'event {i}: inorder != model'; break
            if st['size'] != len(m):
                bad = f'event {i}: size {st["size"]} != {len(m)}'; break
            bad = check_rb(st['node'], len(m))
            if bad:
                bad = f'event {i}: {bad}'; break
        print(f"{'FAIL' if bad else 'PASS'} rb seed={seed}: size={len(model):3d}" + (f' {bad}' if bad else ''))
        fail |= bool(bad)

    # heap: property + sorted drain
    for seed in range(1, 11):
        r = random.Random(100 + seed)
        vals = [r.randint(-50, 50) for _ in range(16)]
        lines = [f'heap push {v}' for v in vals] + ['heap push 1'] + ['heap pop'] * 16
        evs = events(lines)
        bad = None
        for ev in evs[:16]:
            a = ev['state']['heap']['items']
            if any(a[i] > a[c] for i in range(len(a)) for c in (2 * i + 1, 2 * i + 2) if c < len(a)):
                bad = 'heap property violated'; break
        if not bad and evs[16]['ok']:
            bad = 'push on a full heap should fail'
        popped = [int(e['msg'].split()[3]) for e in evs[17:] if e['ok']]
        if not bad and popped != sorted(vals):
            bad = 'pop order is not sorted'
        print(f"{'FAIL' if bad else 'PASS'} heap seed={seed}" + (f' {bad}' if bad else ''))
        fail |= bool(bad)
    sys.exit(1 if fail else 0)


if __name__ == '__main__':
    main()
