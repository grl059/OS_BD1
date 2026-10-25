// SPDX-License-Identifier: GPL-2.0
/*
 * kds_module.c - Kernel Data Structures (F.CSM302 BD1, topic 4, Chapter 3).
 *
 * Operating System Concepts, Chapter 3 Programming Project "Kernel Data
 * Structures" (Section 1.9 explains the structures themselves):
 *   Part I  - struct color items kept in a kernel list_head list:
 *             create, traverse (list_for_each_entry), delete and free.
 *   Part II - module parameter `start`: the Collatz sequence that begins at
 *             start is stored in a linked list, printed when the module is
 *             loaded and printed again while it is deleted on unload.
 *   Extra   - struct birthday list, kfifo (FIFO queue) and bitmap, the same
 *             structures the user-space program and the UI visualise.
 *
 * Build : make -C src/kernel            (needs linux-headers-$(uname -r))
 * Load  : sudo insmod kds_module.ko start=15 ; sudo dmesg | tail -40
 * Unload: sudo rmmod kds_module          ; sudo dmesg | tail -40
 */
#include <linux/init.h>
#include <linux/kernel.h>
#include <linux/module.h>
#include <linux/moduleparam.h>
#include <linux/list.h>
#include <linux/slab.h>
#include <linux/bitmap.h>
#include <linux/kfifo.h>

#define COLLATZ_MAX_TERMS 1000	/* safety cap; start=27 needs 112 terms */

/* ---- Part II: module parameter ---- */
static int start = 25;
module_param(start, int, 0444);
MODULE_PARM_DESC(start, "First term of the Collatz sequence (1..1000000, default 25)");

/* ---- Part I: colors ---- */
struct color {
	int red;
	int blue;
	int green;
	struct list_head list;
};

struct collatz {
	unsigned long value;
	struct list_head list;
};

struct birthday {
	int day, month, year;
	struct list_head list;
};

static LIST_HEAD(color_list);
static LIST_HEAD(collatz_list);
static LIST_HEAD(birthday_list);
static DECLARE_KFIFO(fifo, int, 16);	/* kfifo size must be a power of 2 */
static DECLARE_BITMAP(bits, 32);

static void free_all(void)
{
	struct color *c, *cn;
	struct collatz *z, *zn;
	struct birthday *b, *bn;

	list_for_each_entry_safe(c, cn, &color_list, list) {
		list_del(&c->list);
		kfree(c);
	}
	list_for_each_entry_safe(z, zn, &collatz_list, list) {
		list_del(&z->list);
		kfree(z);
	}
	list_for_each_entry_safe(b, bn, &birthday_list, list) {
		list_del(&b->list);
		kfree(b);
	}
}

static int add_color(int r, int b, int g)
{
	struct color *c = kmalloc(sizeof(*c), GFP_KERNEL);

	if (!c)
		return -ENOMEM;
	c->red = r;
	c->blue = b;
	c->green = g;
	INIT_LIST_HEAD(&c->list);
	list_add_tail(&c->list, &color_list);
	return 0;
}

static int build_collatz(unsigned long n, int *terms)
{
	struct collatz *z;
	int count = 0;

	for (;;) {
		z = kmalloc(sizeof(*z), GFP_KERNEL);
		if (!z)
			return -ENOMEM;
		z->value = n;
		INIT_LIST_HEAD(&z->list);
		list_add_tail(&z->list, &collatz_list);
		count++;
		if (n == 1 || count >= COLLATZ_MAX_TERMS)
			break;
		n = (n % 2) ? 3 * n + 1 : n / 2;
	}
	*terms = count;
	return 0;
}

static int __init kds_init(void)
{
	static const int d[] = {2, 17, 29, 5, 30};
	static const int m[] = {8, 3, 2, 11, 12};
	static const int y[] = {1995, 1998, 2000, 2001, 2003};
	struct color *c;
	struct collatz *z;
	struct birthday *p;
	int i, v, terms = 0, ret;

	pr_info("kds: loading module (start=%d)\n", start);

	/* Part II input check: an invalid parameter must not load the module */
	if (start < 1 || start > 1000000) {
		pr_err("kds: start must be 1..1000000 (got %d)\n", start);
		return -EINVAL;
	}

	/* Part I: four colors, traverse, keep them until unload */
	ret = add_color(255, 0, 0);
	if (!ret)
		ret = add_color(0, 255, 0);
	if (!ret)
		ret = add_color(0, 0, 255);
	if (!ret)
		ret = add_color(128, 64, 32);
	if (ret)
		goto fail;
	list_for_each_entry(c, &color_list, list)
		pr_info("kds: color red=%d blue=%d green=%d\n", c->red, c->blue, c->green);

	/* Part II: Collatz sequence in a linked list */
	ret = build_collatz(start, &terms);
	if (ret)
		goto fail;
	list_for_each_entry(z, &collatz_list, list)
		pr_info("kds: collatz %lu\n", z->value);
	pr_info("kds: collatz start=%d terms=%d%s\n", start, terms,
		terms >= COLLATZ_MAX_TERMS ? " (capped)" : "");

	/* Extra: struct birthday list */
	for (i = 0; i < 5; i++) {
		p = kmalloc(sizeof(*p), GFP_KERNEL);
		if (!p) {
			ret = -ENOMEM;
			goto fail;
		}
		p->day = d[i];
		p->month = m[i];
		p->year = y[i];
		INIT_LIST_HEAD(&p->list);
		list_add_tail(&p->list, &birthday_list);
	}
	list_for_each_entry(p, &birthday_list, list)
		pr_info("kds: birthday %d/%d/%d\n", p->day, p->month, p->year);

	/* Extra: kfifo (FIFO queue) */
	INIT_KFIFO(fifo);
	for (i = 1; i <= 3; i++)
		kfifo_put(&fifo, i * 10);
	while (kfifo_get(&fifo, &v))
		pr_info("kds: fifo out %d\n", v);

	/* Extra: bitmap */
	bitmap_zero(bits, 32);
	set_bit(0, bits);
	set_bit(5, bits);
	set_bit(15, bits);
	clear_bit(5, bits);
	pr_info("kds: bitmap weight=%d, bit15=%d\n",
		bitmap_weight(bits, 32), test_bit(15, bits));
	return 0;

fail:
	/* module_exit() is not called when init fails, so clean up here */
	pr_err("kds: init failed (%d)\n", ret);
	free_all();
	return ret;
}

static void __exit kds_exit(void)
{
	struct color *c, *cn;
	struct collatz *z, *zn;
	struct birthday *p, *pn;

	list_for_each_entry_safe(c, cn, &color_list, list) {
		pr_info("kds: removing color red=%d blue=%d green=%d\n", c->red, c->blue, c->green);
		list_del(&c->list);
		kfree(c);
	}
	list_for_each_entry_safe(z, zn, &collatz_list, list) {
		pr_info("kds: removing collatz %lu\n", z->value);
		list_del(&z->list);
		kfree(z);
	}
	list_for_each_entry_safe(p, pn, &birthday_list, list) {
		pr_info("kds: removing birthday %d/%d/%d\n", p->day, p->month, p->year);
		list_del(&p->list);
		kfree(p);
	}
	pr_info("kds: module unloaded\n");
}

module_init(kds_init);
module_exit(kds_exit);
MODULE_LICENSE("GPL");
MODULE_AUTHOR("F.CSM302 BD1 team 4");
MODULE_DESCRIPTION("Kernel data structures: list_head (color, Collatz, birthday), kfifo, bitmap");
