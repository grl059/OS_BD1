// SPDX-License-Identifier: GPL-2.0
/* kds_module.c - Kernel Data Structures project (OS Concepts, Ch.3 projects).
 * Part 1: struct birthday kept in a kernel list_head list.
 * Part 2: FIFO queue and bitmap using kernel facilities.
 * Load: sudo insmod kds_module.ko ; view: sudo dmesg ; unload: sudo rmmod kds_module
 * NOTE: needs a Linux VM with kernel headers; it was not compiled in the
 * authoring sandbox (see Report, section "Limitations"). */
#include <linux/init.h>
#include <linux/kernel.h>
#include <linux/module.h>
#include <linux/list.h>
#include <linux/slab.h>
#include <linux/bitmap.h>
#include <linux/kfifo.h>

struct birthday {
	int day, month, year;
	struct list_head list;
};

static LIST_HEAD(birthday_list);
static DECLARE_KFIFO(fifo, int, 16);        /* capacity must be a power of 2 */
static DECLARE_BITMAP(bits, 32);

static void free_all(void)
{
	struct birthday *p, *next;

	list_for_each_entry_safe(p, next, &birthday_list, list) {
		list_del(&p->list);
		kfree(p);
	}
}

static int __init kds_init(void)
{
	static const int d[] = {2, 17, 29, 5, 30}, m[] = {8, 3, 2, 11, 12}, y[] = {1995, 1998, 2000, 2001, 2003};
	struct birthday *p;
	int i, v;

	pr_info("kds: loading module\n");
	for (i = 0; i < 5; i++) {
		p = kmalloc(sizeof(*p), GFP_KERNEL);
		if (!p) {
			free_all();              /* exit() is not called when init fails */
			return -ENOMEM;
		}
		p->day = d[i]; p->month = m[i]; p->year = y[i];
		INIT_LIST_HEAD(&p->list);
		list_add_tail(&p->list, &birthday_list);
	}
	list_for_each_entry(p, &birthday_list, list)
		pr_info("kds: birthday %d/%d/%d\n", p->day, p->month, p->year);

	INIT_KFIFO(fifo);
	for (i = 1; i <= 3; i++)
		kfifo_put(&fifo, i * 10);
	while (kfifo_get(&fifo, &v))
		pr_info("kds: fifo out %d\n", v);

	bitmap_zero(bits, 32);
	set_bit(0, bits); set_bit(5, bits); set_bit(15, bits); clear_bit(5, bits);
	pr_info("kds: bitmap weight=%d, bit15=%d\n", bitmap_weight(bits, 32), test_bit(15, bits));
	return 0;
}

static void __exit kds_exit(void)
{
	struct birthday *p, *next;

	list_for_each_entry_safe(p, next, &birthday_list, list) {
		pr_info("kds: removing %d/%d/%d\n", p->day, p->month, p->year);
		list_del(&p->list);
		kfree(p);
	}
	pr_info("kds: module unloaded\n");
}

module_init(kds_init);
module_exit(kds_exit);
MODULE_LICENSE("GPL");
MODULE_DESCRIPTION("Kernel data structures: list_head, kfifo, bitmap");
