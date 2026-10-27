#!/bin/sh
# Builds the kernel module, signs it when Secure Boot is on, loads it with
# three parameters and saves the evidence for the report:
#   docs/kernel_build_log.txt   - environment + compiler output
#   docs/kernel_dmesg.txt       - dmesg lines of every load / unload + `cat /proc/kds`
# Run on a real Linux machine (not WSL/Docker) with linux-headers-$(uname -r):
#   sh src/kernel/run_module_test.sh
# Signing key (Secure Boot): ~/mok/MOK.priv + ~/mok/MOK.der, or set MOK_DIR.
set -u
cd "$(dirname "$0")" || exit 1
DOCS=../../docs
MOK_DIR=${MOK_DIR:-$HOME/mok}
SIGN=/usr/src/linux-headers-$(uname -r)/scripts/sign-file
mkdir -p "$DOCS"
fail=0

# ---- 1. build ----
make clean >/dev/null 2>&1
{ echo "# date:   $(date '+%F %T')"
  echo "# host:   $(uname -n)"
  echo "# kernel: $(uname -r)"
  echo "# os:     $(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-unknown}")"
  echo "# gcc:    $(gcc --version | head -1)"
  echo "# secure boot: $(mokutil --sb-state 2>/dev/null || echo unknown)"
  echo
  make 2>&1; echo "make exit=$?"
} | tee "$DOCS/kernel_build_log.txt"
if [ ! -f kds_module.ko ]; then
  echo "FAIL build (see docs/kernel_build_log.txt)"; exit 1
fi
echo "PASS build"

# ---- 2. sign (only when Secure Boot is enabled) ----
if mokutil --sb-state 2>/dev/null | grep -qi 'enabled'; then
  if [ -f "$MOK_DIR/MOK.priv" ] && [ -f "$MOK_DIR/MOK.der" ]; then
    sudo "$SIGN" sha256 "$MOK_DIR/MOK.priv" "$MOK_DIR/MOK.der" kds_module.ko \
      && echo "PASS sign ($MOK_DIR)" | tee -a "$DOCS/kernel_build_log.txt" \
      || { echo "FAIL sign"; exit 1; }
  else
    echo "FAIL sign: Secure Boot is on but $MOK_DIR/MOK.priv / MOK.der not found (Manual 2.7)"; exit 1
  fi
fi
modinfo kds_module.ko | grep -E '^(filename|parm|signer|vermagic)' | tee -a "$DOCS/kernel_build_log.txt"

# ---- 3. load / unload ----
sudo rmmod kds_module 2>/dev/null
: > "$DOCS/kernel_dmesg.txt"
run() {   # $1 = insmod arguments, $2 = expected result (ok|fail)
  echo "### insmod kds_module.ko $1" >> "$DOCS/kernel_dmesg.txt"
  sudo dmesg -C
  if sudo insmod kds_module.ko $1 2>>"$DOCS/kernel_dmesg.txt"; then
    got=ok
    lsmod | grep -q '^kds_module' && echo "(lsmod: kds_module loaded)" >> "$DOCS/kernel_dmesg.txt"
    if [ -r /proc/kds ]; then
      { echo "### cat /proc/kds"; cat /proc/kds; } >> "$DOCS/kernel_dmesg.txt" 2>&1
      if grep -q '^start=' /proc/kds && grep -q '^hashtable(' /proc/kds && grep -q '^rbtree(' /proc/kds; then
        echo "PASS /proc/kds ($1)"
      else
        echo "FAIL /proc/kds content ($1)"; fail=1
      fi
    else
      echo "FAIL /proc/kds missing ($1)"; fail=1
    fi
    sudo rmmod kds_module
    echo "### rmmod kds_module" >> "$DOCS/kernel_dmesg.txt"
  else
    got=fail
  fi
  sudo dmesg | grep 'kds:' >> "$DOCS/kernel_dmesg.txt"
  echo >> "$DOCS/kernel_dmesg.txt"
  if [ "$got" = "$2" ]; then echo "PASS insmod $1 ($got)"; else echo "FAIL insmod $1 (got $got, expected $2)"; fail=1; fi
}
run ""          ok      # default start=25 -> 24 Collatz terms
run "start=15"  ok      # 15 -> 18 terms
run "start=0"   fail    # rejected with -EINVAL

# ---- 4. check the Collatz output ----
n25=$(awk '/^### insmod kds_module.ko $/{f=1;next} /^### insmod/{f=0} f' "$DOCS/kernel_dmesg.txt" | grep -c 'kds: collatz [0-9]*$')
n15=$(awk '/start=15/{f=1;next} /^### insmod/{f=0} f' "$DOCS/kernel_dmesg.txt" | grep -c 'kds: collatz [0-9]*$')
[ "$n25" -eq 24 ] && echo "PASS collatz start=25: 24 terms" || { echo "FAIL collatz start=25: $n25 terms (expected 24)"; fail=1; }
[ "$n15" -eq 18 ] && echo "PASS collatz start=15: 18 terms" || { echo "FAIL collatz start=15: $n15 terms (expected 18)"; fail=1; }

make clean >/dev/null 2>&1
echo "Saved docs/kernel_build_log.txt and docs/kernel_dmesg.txt"
exit $fail
