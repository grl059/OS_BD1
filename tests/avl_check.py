"""AVL invariant check on the C program.

30 random runs: switch the tree to AVL, insert and delete random values,
then check with `tree print` that
  * the in-order list equals the sorted set of values that should be there,
  * the height stays within the AVL bound  h <= 1.44 * log2(n + 2).
A sorted insert of 1..N is also checked against a plain BST (height N).

    python3 tests/avl_check.py
"""
import math
import os
import random
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KDS = os.path.join(ROOT, 'kds')


def run(lines):
    out = subprocess.run([KDS], input='\n'.join(lines) + '\n', capture_output=True, text=True).stdout
    return [l for l in out.splitlines() if l.startswith('TREE')]


def parse(line):
    m = re.match(r'TREE(?:\(avl\))? size=(\d+) height=(\d+) inorder:(.*)', line)
    vals = [] if '(empty)' in m.group(3) else [int(x) for x in m.group(3).split(',')]
    return int(m.group(1)), int(m.group(2)), vals


def main():
    if not os.path.exists(KDS):
        sys.exit('ERR: ./kds not found, run make first')
    fail = 0
    for seed in range(1, 31):
        r = random.Random(seed)
        model, lines = set(), ['tree mode avl']
        checks = []
        for step in range(r.randint(50, 400)):
            v = r.randint(0, 500)
            if r.random() < 0.65:
                lines.append(f'tree insert {v}'); model.add(v)
            else:
                lines.append(f'tree delete {v}'); model.discard(v)
            if step % 25 == 0:
                lines.append('tree print'); checks.append(sorted(model))
        lines.append('tree print'); checks.append(sorted(model))
        for want, line in zip(checks, run(lines)):
            n, h, vals = parse(line)
            bound = 1.44 * math.log2(n + 2) if n else 0
            if vals != want or n != len(want) or h > bound:
                print(f'FAIL avl seed={seed}: size={n} height={h} bound={bound:.2f} contents_ok={vals == want}')
                fail = 1
                break
        else:
            n, h, _ = parse(run(lines)[-1])
            print(f'PASS avl seed={seed:2d}: size={n:3d} height={h:2d} <= {1.44 * math.log2(n + 2):.2f}')
    # sorted input: BST degenerates, AVL does not
    for mode, expect in (('bst', 15), ('avl', 4)):
        n, h, _ = parse(run([f'tree mode {mode}'] + [f'tree insert {i}' for i in range(1, 16)] + ['tree print'])[-1])
        ok = h == expect
        fail |= not ok
        print(f'{"PASS" if ok else "FAIL"} sorted 1..15 in {mode}: height={h} (expected {expect})')
    sys.exit(fail)


if __name__ == '__main__':
    main()
