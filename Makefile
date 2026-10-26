CC ?= gcc
CFLAGS = -Wall -Wextra -O1 -g -fsanitize=address,undefined


all: kds


kds: src/user/kds.c
	$(CC) $(CFLAGS) -o kds src/user/kds.c

# example scripts vs expected output + stress (C only)

# example scripts vs expected output + stress (C only)
test: kds
	@sh tests/run_tests.sh

# everything: make test + text==--json (examples) + random differential
# text-vs-json fuzz + AVL invariants
check: test
	@python3 tests/json_check.py
	@python3 tests/fuzz_json.py 8 5000
	@python3 tests/avl_check.py

# Kernel module: real Linux with linux-headers-$(uname -r)
module:
	$(MAKE) -C src/kernel

clean:
	rm -f kds
	-$(MAKE) -C src/kernel clean 2>/dev/null

.PHONY: all test check module clean
	-$(MAKE) -C src/kernel clean 2>/dev/null

.PHONY: all test check module clean
