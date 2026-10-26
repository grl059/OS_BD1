#!/bin/sh
# Needs node and python3. Runs every example script through the UI engine
# (extracted from docs/ui/index.html) and compares it with the expected
# output of the C program.
cd "$(dirname "$0")/.." || exit 1
tmp=$(mktemp -d) || exit 1
trap 'rm -rf "$tmp"' EXIT
python3 tests/ui_engine.py "$tmp/engine.js" || exit 1
fail=0
for t in textbook all_structures errors scheduler scheduler_full search; do
  if node "$tmp/engine.js" examples/$t.txt | diff -u tests/expected_$t.out - > "$tmp/diff"; then
    echo "PASS ui==c $t"
  else
    echo "FAIL ui!=c $t"; cat "$tmp/diff"; fail=1
  fi
done
exit $fail
