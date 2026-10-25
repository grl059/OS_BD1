#!/bin/sh
# Builds the kernel module, loads it with two parameters, checks that an
# invalid parameter is rejected, and saves the evidence for the report:
#   docs/kernel_build_log.txt   - compiler output
#   docs/kernel_dmesg.txt       - dmesg lines of every load / unload
# Run on a real Linux machine (not WSL) with linux-headers-$(uname -r):
#   sh src/kernel/run_module_test.sh
set -u
cd "$(dirname "$0")" || exit 1
DOCS=../../docs
mkdir -p "$DOCS"

{ echo "# $(date '+%F %T')  kernel $(uname -r)  $(gcc --version | head -1)"
  make 2>&1; echo "exit=$?"; } | tee "$DOCS/kernel_build_log.txt"
[ -f kds_module.ko ] || { echo "FAIL build (see docs/kernel_build_log.txt)"; exit 1; }

sudo rmmod kds_module 2>/dev/null
: > "$DOCS/kernel_dmesg.txt"
run() {   # $1 = insmod arguments, $2 = expected result (ok|fail)
  echo "### insmod kds_module.ko $1" >> "$DOCS/kernel_dmesg.txt"
  sudo dmesg -C
  if sudo insmod kds_module.ko $1 2>>"$DOCS/kernel_dmesg.txt"; then got=ok; else got=fail; fi
  if [ "$got" = ok ]; then
    sudo rmmod kds_module
  fi
  sudo dmesg | grep 'kds:' >> "$DOCS/kernel_dmesg.txt"
  if [ "$got" = "$2" ]; then echo "PASS insmod $1 ($got)"; else echo "FAIL insmod $1 (got $got, expected $2)"; fi
}
run ""          ok      # default start=25 -> 24 Collatz terms
run "start=15"  ok      # 15 -> 18 terms
run "start=0"   fail    # rejected with -EINVAL
echo "Saved docs/kernel_build_log.txt and docs/kernel_dmesg.txt"
