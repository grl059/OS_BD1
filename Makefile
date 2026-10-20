CC ?= gcc
CFLAGS = -Wall -Wextra -O1 -g -fsanitize=address,undefined
all: kds
kds: src/user/kds.c
	$(CC) $(CFLAGS) -o kds src/user/kds.c
test: kds
	@sh tests/run_tests.sh
clean:
	rm -f kds
# Kernel module (Linux VM + headers): make -C /lib/modules/$$(uname -r)/build M=$$PWD/src/kernel modules
