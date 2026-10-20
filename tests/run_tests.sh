#!/bin/sh
# Runs example scripts through the C program and compares with expected output.
fail=0
for t in textbook all_structures errors; do
  ./kds examples/$t.txt > /tmp/kds_$t.out 2>&1
  if diff -u tests/expected_$t.out /tmp/kds_$t.out >/dev/null; then echo "PASS $t"; else echo "FAIL $t"; diff -u tests/expected_$t.out /tmp/kds_$t.out; fail=1; fi
done
# Stress: 5000 push/pop on queue/stack with ASan enabled must not leak or crash
( i=0; while [ $i -lt 5000 ]; do echo "queue push 1"; echo "queue pop"; echo "stack push 2"; echo "stack pop"; i=$((i+1)); done ) | ./kds | grep -c ERR | grep -qx 0 && echo "PASS stress" || { echo "FAIL stress"; fail=1; }
exit $fail
