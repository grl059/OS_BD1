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
 *   Extra 2 - hash table with <linux/hashtable.h> (DEFINE_HASHTABLE,
 *             hash_add, hash_for_each, hash_for_each_possible, hash_del)
 *             and a red-black tree with <linux/rbtree.h> (rb_link_node,
 *             rb_insert_color, rb_first/rb_next, rb_erase).
 *   /proc   - `cat /proc/kds` prints the live state of every structure
 *             (seq_file, single_open; Chapter 2 "/proc file system" project).
 *
 * Build : make -C src/kernel            (needs linux-headers-$(uname -r))
 * Load  : sudo insmod kds_module.ko start=15 ; sudo dmesg | tail -40
 * Read  : cat /proc/kds
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
#include <linux/hashtable.h>
#include <linux/rbtree.h>
#include <linux/proc_fs.h>
#include <linux/seq_file.h>
#include <linux/string.h>
#include <linux/version.h>

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

/* hashtable.h: hlist_head buckets, 2^3 = 8 of them (same as the user-space default) */
struct kv {
	char key[16];
	int value;
	struct hlist_node node;
};

/* rbtree.h: the node is embedded, rb_entry() (container_of) gets the item back */
struct rbitem {
	int val;
	struct rb_node node;
};

static LIST_HEAD(color_list);
static LIST_HEAD(collatz_list);
static LIST_HEAD(birthday_list);
static DECLARE_KFIFO(fifo, int, 16);	/* kfifo size must be a power of 2 */
static DECLARE_BITMAP(bits, 32);
static DEFINE_HASHTABLE(kds_hash, 3);
static struct rb_root kds_rb = RB_ROOT;
static int collatz_terms, nhash, nrb;

/* same key function as the user-space program: sum of the character codes */
static u32 kv_key(const char *s)
{
	u32 sum = 0;

	for (; *s; s++)
		sum += (unsigned char)*s;
	return sum;
}

static int add_kv(const char *key, int value)
{
	struct kv *e = kmalloc(sizeof(*e), GFP_KERNEL);

	if (!e)
		return -ENOMEM;
	strscpy(e->key, key, sizeof(e->key));
	e->value = value;
	hash_add(kds_hash, &e->node, kv_key(key));	/* adds at the head of the bucket */
	nhash++;
	return 0;
}

static struct kv *find_kv(const char *key)
{
	struct kv *e;

	/* only walks the one bucket the key hashes to */
	hash_for_each_possible(kds_hash, e, node, kv_key(key))
		if (!strcmp(e->key, key))
			return e;
	return NULL;
}

static struct rbitem *rb_find_item(int val)
{
	struct rb_node *n = kds_rb.rb_node;

	while (n) {
		struct rbitem *it = rb_entry(n, struct rbitem, node);

		if (val < it->val)
			n = n->rb_left;
		else if (val > it->val)
			n = n->rb_right;
		else
			return it;
	}
	return NULL;
}

static int rb_insert_item(int val)
{
	struct rb_node **link = &kds_rb.rb_node, *parent = NULL;
	struct rbitem *it;

	while (*link) {
		struct rbitem *cur = rb_entry(*link, struct rbitem, node);

		parent = *link;
		if (val < cur->val)
			link = &(*link)->rb_left;
		else if (val > cur->val)
			link = &(*link)->rb_right;
		else
			return -EEXIST;
	}
	it = kmalloc(sizeof(*it), GFP_KERNEL);
	if (!it)
		return -ENOMEM;
	it->val = val;
	rb_link_node(&it->node, parent, link);	/* attach as a red leaf ... */
	rb_insert_color(&it->node, &kds_rb);	/* ... then recolor / rotate */
	nrb++;
	return 0;
}

static void free_all(void)
{
	struct color *c, *cn;
	struct collatz *z, *zn;
	struct birthday *b, *bn;
	struct kv *e;
	struct hlist_node *tmp;
	struct rbitem *ri, *rin;
	int bkt;

	hash_for_each_safe(kds_hash, bkt, tmp, e, node) {
		hash_del(&e->node);
		kfree(e);
	}
	nhash = 0;
	rbtree_postorder_for_each_entry_safe(ri, rin, &kds_rb, node)
		kfree(ri);
	kds_rb = RB_ROOT;
	nrb = 0;
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

/* ---- /proc/kds: cat /proc/kds shows the live state of every structure ---- */
static int kds_proc_show(struct seq_file *m, void *v)
{
	struct color *c;
	struct collatz *z;
	struct birthday *p;
	struct kv *e;
	struct rb_node *rn;
	int bkt, first;

	seq_printf(m, "start=%d\n", start);
	seq_puts(m, "colors:\n");
	list_for_each_entry(c, &color_list, list)
		seq_printf(m, "  red=%d blue=%d green=%d\n", c->red, c->blue, c->green);
	seq_printf(m, "collatz(terms=%d):", collatz_terms);
	list_for_each_entry(z, &collatz_list, list)
		seq_printf(m, " %lu", z->value);
	seq_puts(m, "\nbirthdays:\n");
	list_for_each_entry(p, &birthday_list, list)
		seq_printf(m, "  %d/%d/%d\n", p->day, p->month, p->year);
	seq_printf(m, "hashtable(buckets=%d, entries=%d):\n", (int)HASH_SIZE(kds_hash), nhash);
	for (bkt = 0; bkt < (int)HASH_SIZE(kds_hash); bkt++) {
		if (hlist_empty(&kds_hash[bkt]))
			continue;
		first = 1;
		seq_printf(m, "  bucket %d:", bkt);
		hlist_for_each_entry(e, &kds_hash[bkt], node) {
			seq_printf(m, "%s %s=%d", first ? "" : " ->", e->key, e->value);
			first = 0;
		}
		seq_putc(m, '\n');
	}
	seq_printf(m, "rbtree(nodes=%d, in-order):", nrb);
	for (rn = rb_first(&kds_rb); rn; rn = rb_next(rn))
		seq_printf(m, " %d", rb_entry(rn, struct rbitem, node)->val);
	seq_printf(m, "\nbitmap(32): weight=%d bit15=%d\n", bitmap_weight(bits, 32), test_bit(15, bits));
	return 0;
}

static int kds_proc_open(struct inode *inode, struct file *file)
{
	return single_open(file, kds_proc_show, NULL);
}

#if LINUX_VERSION_CODE >= KERNEL_VERSION(5, 6, 0)
static const struct proc_ops kds_proc_ops = {
	.proc_open	= kds_proc_open,
	.proc_read	= seq_read,
	.proc_lseek	= seq_lseek,
	.proc_release	= single_release,
};
#else
static const struct file_operations kds_proc_ops = {
	.owner		= THIS_MODULE,
	.open		= kds_proc_open,
	.read		= seq_read,
	.llseek		= seq_lseek,
	.release	= single_release,
};
#endif

static int __init kds_init(void)
{
	static const int d[] = {2, 17, 29, 5, 30};
	static const int m[] = {8, 3, 2, 11, 12};
	static const int y[] = {1995, 1998, 2000, 2001, 2003};
	struct color *c;
	struct collatz *z;
	struct birthday *p;
	static const char * const kv_names[] = {"alice", "bob", "carol", "dave", "erin"};
	static const int rb_vals[] = {50, 30, 70, 20, 40, 60, 80};
	struct kv *e;
	struct rbitem *ri;
	struct rb_node *rn;
	int i, v, bkt, terms = 0, ret;

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
	collatz_terms = terms;
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

	/* Extra 2: hashtable.h - add, iterate all, look up one key, delete */
	for (i = 0; i < ARRAY_SIZE(kv_names); i++) {
		ret = add_kv(kv_names[i], i + 1);
		if (ret)
			goto fail;
	}
	hash_for_each(kds_hash, bkt, e, node)
		pr_info("kds: hash bucket=%d %s=%d\n", bkt, e->key, e->value);
	e = find_kv("bob");
	pr_info("kds: hash get bob = %d\n", e ? e->value : -1);
	if (e) {
		hash_del(&e->node);
		kfree(e);
		nhash--;
		pr_info("kds: hash del bob (entries=%d)\n", nhash);
	}
	pr_info("kds: hash get bob = %s\n", find_kv("bob") ? "found" : "not found");

	/* Extra 2: rbtree.h - insert 7 keys, in-order walk, erase one, look up */
	for (i = 0; i < ARRAY_SIZE(rb_vals); i++) {
		ret = rb_insert_item(rb_vals[i]);
		if (ret)
			goto fail;
	}
	for (rn = rb_first(&kds_rb); rn; rn = rb_next(rn))
		pr_info("kds: rb %d\n", rb_entry(rn, struct rbitem, node)->val);
	ri = rb_find_item(30);
	if (ri) {
		rb_erase(&ri->node, &kds_rb);
		kfree(ri);
		nrb--;
		pr_info("kds: rb erase 30 (nodes=%d)\n", nrb);
	}
	pr_info("kds: rb find 40 = %s\n", rb_find_item(40) ? "yes" : "no");

	/* /proc/kds is created last: everything it prints already exists */
	if (!proc_create("kds", 0444, NULL, &kds_proc_ops)) {
		ret = -ENOMEM;
		goto fail;
	}
	pr_info("kds: /proc/kds created\n");
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
	struct kv *e;
	struct hlist_node *tmp;
	struct rbitem *ri, *rin;
	int bkt;

	remove_proc_entry("kds", NULL);		/* first: no reader can touch the lists below */
	hash_for_each_safe(kds_hash, bkt, tmp, e, node) {
		pr_info("kds: removing hash %s=%d\n", e->key, e->value);
		hash_del(&e->node);
		kfree(e);
	}
	rbtree_postorder_for_each_entry_safe(ri, rin, &kds_rb, node) {
		pr_info("kds: removing rb %d\n", ri->val);
		kfree(ri);
	}
	kds_rb = RB_ROOT;
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
MODULE_DESCRIPTION("Kernel data structures: list_head (color, Collatz, birthday), kfifo, bitmap, hashtable, rbtree, /proc/kds");
