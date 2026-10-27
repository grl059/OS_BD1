#!/bin/sh
# Runs every example script through the C program (./kds, built with
# ASan + UBSan) and compares the output with tests/expected_*.out.
cd "$(dirname "$0")/.." || exit 1
tmp=$(mktemp -d) || exit 1
trap 'rm -rf "$tmp"' EXIT
fail=0
for t in textbook all_structures errors scheduler scheduler_full search hash_resize rb_heap; do
  ./kds examples/$t.txt > "$tmp/$t.out" 2>&1
  if diff -u tests/expected_$t.out "$tmp/$t.out" > "$tmp/diff"; then
    echo "PASS $t"
  else
    echo "FAIL $t"; cat "$tmp/diff"; fail=1
  fi
done
# Stress: 5000 rounds of push/pop on queue and stack plus hash put/del and
# process create/run. Any ERR line or sanitizer report (leak, UB) fails.
( i=0
  while [ $i -lt 5000 ]; do
    echo "queue push $i"; echo "queue pop"; echo "stack push $i"; echo "stack pop"
    echo "hash put k$i $i"; echo "hash del k$i"
    echo "proc new p 1"; echo "sched tick"
    i=$((i+1))
  done ) | ./kds > "$tmp/stress.out" 2>&1
if grep -q -e '^ERR' -e 'Sanitizer' -e 'runtime error' "$tmp/stress.out"; then
  echo "FAIL stress"; grep -m5 -e '^ERR' -e 'Sanitizer' -e 'runtime error' "$tmp/stress.out"; fail=1
else
  echo "PASS stress (5000 x 8 commands, ERR 0, no sanitizer report)"
fi
exit $fail
