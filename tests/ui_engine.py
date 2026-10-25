"""Extracts the ENGINE block from docs/ui/index.html into a Node.js script.

The generated script reads command lines from a file (argv[2]) or stdin and
prints exactly what the UI shows in its raw console, so its output can be
diffed against ./kds.  Used by test_ui_matches_c.sh and fuzz_compare.py.

    python3 tests/ui_engine.py OUT.js
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUNNER = r"""
const fs = require('fs');
const src = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : fs.readFileSync(0, 'utf8');
reset();
const out = [];
for (const l of src.split('\n')) { const r = exec(l); if (r !== null) out.push(r); }
process.stdout.write(out.length ? out.join('\n') + '\n' : '');
"""


def build(out_path):
    with open(os.path.join(ROOT, 'docs', 'ui', 'index.html'), encoding='utf-8') as f:
        html = f.read()
    try:
        engine = html.split('/* ===== ENGINE')[1].split('/* ===== UI')[0]
    except IndexError:
        sys.exit('ERR: ENGINE / UI markers not found in docs/ui/index.html')
    engine = engine.replace('document.getElementById&&draw&&draw();', '')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('/* ENGINE' + engine + RUNNER)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('usage: python3 tests/ui_engine.py OUT.js')
    build(sys.argv[1])
