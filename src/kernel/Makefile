# Kernel module build (Linux with linux-headers-$(uname -r) installed):
#   make            -> kds_module.ko
#   make clean
ifneq ($(KERNELRELEASE),)
obj-m := kds_module.o
else
KDIR ?= /lib/modules/$(shell uname -r)/build

all:
	$(MAKE) -C $(KDIR) M=$(CURDIR) modules

clean:
	$(MAKE) -C $(KDIR) M=$(CURDIR) clean
endif
