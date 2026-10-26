/* kds.c - User-space replica of Linux kernel data structures driven by a
 * small command language (F.CSM302 BD1, topic 4 "Kernel Data Structures").
 *
 *   list   - struct birthday kept in a list_head list (include/linux/list.h)
 *   queue  - FIFO on list_head (add at tail, take from head)
 *   stack  - LIFO on list_head (add at head, take from head)
 *   bitmap - n bits (1..128), set / clear / test
 *   hash   - hash map, chaining with a list_head per bucket
 *   tree   - binary search tree, plain (bst) or balanced (avl)
 *   proc / sched - PCBs in a list_head ready queue, FCFS and Round Robin
 *
 * Default (text) output is unchanged by anything below: every handler still
 * prints the same "OK ..."/"ERR ..." lines it always did, and nothing here
 * is on that path. tests/test_ui_matches_c.sh and tests/fuzz_compare.py
 * check the text output of the old single-file UI against it.
 *
 * `--json` adds a second, additive output mode for the web/ directory: one
 * JSON line per command (step index, cmd/op/args, ok, the same message
 * text, a "hot" locator and a full snapshot of all 7 structures), with
 * state read directly from the same globals the handlers above update -
 * nothing is recomputed or duplicated. See web/EVENT_FORMAT.md for the
 * schema and tests/run_tests.py --json for the test that checks it.
 *
 * Usage: ./kds [--json] [script.txt]   (reads stdin when no file is given) */
#define _GNU_SOURCE
#include <ctype.h>
#include <errno.h>
#include <limits.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stddef.h>

/* ---------- list.h (same semantics as the kernel) ---------- */
#define container_of(ptr, type, m) ((type *)((char *)(ptr) - offsetof(type, m)))
#define list_entry(ptr, type, m) container_of(ptr, type, m)

struct list_head { struct list_head *next, *prev; };
static void INIT_LIST_HEAD(struct list_head *h) { h->next = h->prev = h; }
static void __list_add(struct list_head *n, struct list_head *p, struct list_head *x)
{ x->prev = n; n->next = x; n->prev = p; p->next = n; }
static void list_add(struct list_head *n, struct list_head *h) { __list_add(n, h, h->next); }
static void list_add_tail(struct list_head *n, struct list_head *h) { __list_add(n, h->prev, h); }
static void list_del(struct list_head *e)
{ e->prev->next = e->next; e->next->prev = e->prev; e->next = e->prev = NULL; }
static int list_empty(const struct list_head *h) { return h->next == h; }
#define list_for_each(pos, head) for (pos = (head)->next; pos != (head); pos = pos->next)
#define list_for_each_safe(pos, n, head) \
	for (pos = (head)->next, n = pos->next; pos != (head); pos = n, n = pos->next)

/* ---------- data ---------- */
#define LIMIT 8          /* capacity of queue, stack and alive processes */
#define MAXBITS 128
#define MAXBUCKETS 16
#define HASH_LIMIT 24
#define MAXTOK 16

struct birthday { int day, month, year; struct list_head list; };
struct node { int val; struct list_head list; };   /* queue / stack node */
struct tnode { int val; struct tnode *l, *r; };

#define LIMIT 8      /* capacity of queue and stack */
#define MAXBITS 128
static struct list_head bdays, queue, stack;
static int nb, nq, ns;
static unsigned char bits[MAXBITS];
static int nbits = 32;
static struct list_head buckets[MAXBUCKETS];
static int hn = 8, hsize;
static struct tnode *root;
static int ntree, avl;
static struct list_head ready;
static struct pcb *running;
static int quantum, now, ndone, nextpid = 1, nready;

/* ---------- helpers ---------- */
static void free_nodes(struct list_head *h, size_t off)
{
	struct list_head *p, *n;
	list_for_each_safe(p, n, h) { list_del(p); free((char *)p - off); }
}

/* An integer token: [+-]?digits that fits in int (same rule as isInt in the UI). */
static int is_int(const char *s, int *out)
{
	const char *p = s;
	if (*p == '+' || *p == '-') p++;
	if (!*p) return 0;
	for (; *p; p++) if (!isdigit((unsigned char)*p)) return 0;
	errno = 0;
	long v = strtol(s, NULL, 10);
	if (errno || v > INT_MAX || v < -INT_MAX) return 0;
	if (out) *out = (int)v;
	return 1;
}

/* 1..max characters from [A-Za-z0-9_] */
static int is_word(const char *s, size_t max)
{
	size_t n = strlen(s);
	if (n < 1 || n > max) return 0;
	for (; *s; s++) if (!isalnum((unsigned char)*s) && *s != '_') return 0;
	return 1;
}

static const char *valid_date(int d, int m, int y)
{
	static const int dm[] = {31,28,31,30,31,30,31,31,30,31,30,31};
	if (y < 1900 || y > 2100) return "year must be 1900..2100";
	if (m < 1 || m > 12) return "month must be 1..12";
	int lim = dm[m-1] + (m == 2 && ((y % 4 == 0 && y % 100) || y % 400 == 0));
	if (d < 1 || d > lim) return "day out of range for month";
	return NULL;
}

/* ---------- list (struct birthday) ---------- */
static void list_cmd(const char *op, int na, char **a)
{
	struct list_head *p;
	int d, m, y, i;
	if (!strcmp(op, "print")) {
		int first = 1;
		printf("LIST size=%d:", nb);
		if (!nb) printf(" (empty)");
		list_for_each(p, &bdays) {
			struct birthday *b = list_entry(p, struct birthday, list);
			printf("%s%d/%d/%d", first ? " " : " -> ", b->day, b->month, b->year);
			first = 0;
		}
		printf("\n");
		return;
	}
	if (!strcmp(op, "clear")) {
		free_nodes(&bdays, offsetof(struct birthday, list));
		nb = 0;
		puts("OK list clear (size=0)");
		return;
	}
	int addh = !strcmp(op, "add_head"), addt = !strcmp(op, "add_tail");
	int del = !strcmp(op, "del"), find = !strcmp(op, "find");
	if (!addh && !addt && !del && !find) { puts("ERR list: unknown op"); return; }
	if (na != 3 || !is_int(a[0], &d) || !is_int(a[1], &m) || !is_int(a[2], &y)) {
		puts("ERR list: usage <op> <day> <month> <year>");
		return;
	}
	const char *why = valid_date(d, m, y);
	if (why) { printf("ERR list: %s\n", why); return; }
	if (find || del) {
		i = 0;
		list_for_each(p, &bdays) {
			struct birthday *b = list_entry(p, struct birthday, list);
			if (b->day == d && b->month == m && b->year == y) {
				if (find) { printf("OK list find %d/%d/%d = index %d\n", d, m, y, i); return; }
				list_del(p); free(b); nb--;
				printf("OK list del %d/%d/%d (size=%d)\n", d, m, y, nb);
				return;
			}
			i++;
		}
		if (find) printf("OK list find %d/%d/%d = not found\n", d, m, y);
		else printf("ERR list: %d/%d/%d not found\n", d, m, y);
		return;
	}
	struct birthday *b = malloc(sizeof *b);
	if (!b) { puts("ERR list: out of memory"); return; }
	b->day = d; b->month = m; b->year = y;
	if (addh) list_add(&b->list, &bdays); else list_add_tail(&b->list, &bdays);
	nb++;
	printf("OK list %s %d/%d/%d (size=%d)\n", op, d, m, y, nb);
}

/* ---------- queue / stack ---------- */
static void seq_cmd(const char *name, struct list_head *h, int *n, int lifo,
		    const char *op, int na, char **a)
{
	struct list_head *p;
	int v, i;
	if (!strcmp(op, "push")) {
		if (na != 1 || !is_int(a[0], &v)) { printf("ERR %s: usage push <int>\n", name); return; }
		if (*n >= LIMIT) { printf("ERR %s: overflow (limit %d)\n", name, LIMIT); return; }
		struct node *x = malloc(sizeof *x);
		if (!x) { printf("ERR %s: out of memory\n", name); return; }
		x->val = v;
		if (lifo) list_add(&x->list, h); else list_add_tail(&x->list, h);
		(*n)++;
		printf("OK %s push %d (size=%d)\n", name, v, *n);
	} else if (!strcmp(op, "find")) {
		if (na != 1 || !is_int(a[0], &v)) { printf("ERR %s: usage find <int>\n", name); return; }
		i = 0;
		list_for_each(p, h) {
			if (list_entry(p, struct node, list)->val == v) {
				printf("OK %s find %d = position %d\n", name, v, i);
				return;
			}
			i++;
		}
		printf("OK %s find %d = not found\n", name, v);
	} else if (!strcmp(op, "pop")) {
		if (list_empty(h)) { printf("ERR %s: underflow (empty)\n", name); return; }
		struct node *x = list_entry(h->next, struct node, list);
		v = x->val;
		list_del(&x->list); free(x); (*n)--;
		printf("OK %s pop %d (size=%d)\n", name, v, *n);
	} else if (!strcmp(op, "print")) {
		int first = 1;
		printf("%s size=%d:", lifo ? "STACK(top first)" : "QUEUE(front first)", *n);
		if (!*n) printf(" (empty)");
		list_for_each(p, h) {
			printf("%s%d", first ? " " : ", ", list_entry(p, struct node, list)->val);
			first = 0;
		}
		printf("\n");
	} else printf("ERR %s: unknown op\n", name);
}

/* ---------- bitmap ---------- */
static void bitmap_cmd(const char *op, int na, char **a)
{
	int i;
	if (!strcmp(op, "size")) {
		if (na != 1 || !is_int(a[0], &i) || i < 1 || i > MAXBITS) {
			printf("ERR bitmap: size must be 1..%d\n", MAXBITS);
			return;
		}
		nbits = i;
		memset(bits, 0, sizeof bits);
		printf("OK bitmap size %s\n", a[0]);
		return;
	}
	if (!strcmp(op, "print")) {
		int c = 0;
		printf("BITMAP n=%d: ", nbits);
		for (i = 0; i < nbits; i++) { putchar('0' + bits[i]); c += bits[i]; }
		printf(" (set=%d)\n", c);
		return;
	}
	if (!strcmp(op, "set") || !strcmp(op, "clear") || !strcmp(op, "test")) {
		if (na != 1 || !is_int(a[0], &i)) { puts("ERR bitmap: usage <op> <index>"); return; }
		if (i < 0 || i >= nbits) { printf("ERR bitmap: index %d out of range 0..%d\n", i, nbits - 1); return; }
		if (op[0] == 't') { printf("OK bitmap test %d = %d\n", i, bits[i]); return; }
		bits[i] = (op[0] == 's');
		printf("OK bitmap %s %d\n", op, i);
		return;
	}
	puts("ERR bitmap: unknown op");
}

/* ---------- hash map (chaining) ---------- */
static int hfun(const char *k)
{
	int s = 0;
	for (; *k; k++) s += (unsigned char)*k;
	return s % hn;
}

static void hash_reset(int n)
{
	for (int i = 0; i < MAXBUCKETS; i++) {
		if (buckets[i].next) free_nodes(&buckets[i], offsetof(struct hentry, list));
		INIT_LIST_HEAD(&buckets[i]);
	}
	hn = n;
	hsize = 0;
}

static struct hentry *hfind(int b, const char *k, int *steps)
{
	struct list_head *p;
	int i = 0;
	list_for_each(p, &buckets[b]) {
		struct hentry *e = list_entry(p, struct hentry, list);
		i++;
		if (!strcmp(e->key, k)) { if (steps) *steps = i; return e; }
	}
	return NULL;
}

static void hash_cmd(const char *op, int na, char **a)
{
	int i, b, steps;
	struct list_head *p;
	if (!strcmp(op, "print")) {
		int nz = 0;
		for (i = 0; i < hn; i++) if (!list_empty(&buckets[i])) nz++;
		printf("HASH buckets=%d size=%d collisions=%d:", hn, hsize, hsize - nz);
		if (!hsize) printf(" (empty)");
		for (i = 0; i < hn; i++) {
			if (list_empty(&buckets[i])) continue;
			int first = 1;
			printf(" b%d=[", i);
			list_for_each(p, &buckets[i]) {
				struct hentry *e = list_entry(p, struct hentry, list);
				printf("%s%s:%s", first ? "" : " -> ", e->key, e->val);
				first = 0;
			}
			printf("]");
		}
		printf("\n");
		return;
	}
	if (!strcmp(op, "clear")) { hash_reset(hn); puts("OK hash clear"); return; }
	if (!strcmp(op, "size")) {
		if (na != 1 || !is_int(a[0], &i) || i < 1 || i > MAXBUCKETS) { puts("ERR hash: buckets must be 1..16"); return; }
		hash_reset(i);
		printf("OK hash size %s\n", a[0]);
		return;
	}
	if (!strcmp(op, "put")) {
		if (na != 2) { puts("ERR hash: usage put <key> <value>"); return; }
		if (!is_word(a[0], 12) || !is_word(a[1], 12)) {
			puts("ERR hash: key and value must be 1..12 letters, digits or _");
			return;
		}
		b = hfun(a[0]);
		int had = !list_empty(&buckets[b]);
		struct hentry *e = hfind(b, a[0], NULL);
		if (e) {
			strcpy(e->val, a[1]);
			printf("OK hash put %s = %s (updated, bucket=%d)\n", a[0], a[1], b);
			return;
		}
		if (hsize >= HASH_LIMIT) { printf("ERR hash: full (limit %d)\n", HASH_LIMIT); return; }
		e = malloc(sizeof *e);
		if (!e) { puts("ERR hash: out of memory"); return; }
		strcpy(e->key, a[0]); strcpy(e->val, a[1]);
		list_add_tail(&e->list, &buckets[b]);
		hsize++;
		printf("OK hash put %s -> %s (bucket=%d, size=%d%s)\n", a[0], a[1], b, hsize, had ? ", collision" : "");
		return;
	}
	if (!strcmp(op, "get") || !strcmp(op, "del")) {
		if (na != 1) { printf("ERR hash: usage %s <key>\n", op); return; }
		if (!is_word(a[0], 12)) { puts("ERR hash: key must be 1..12 letters, digits or _"); return; }
		b = hfun(a[0]);
		struct hentry *e = hfind(b, a[0], &steps);
		if (op[0] == 'g') {
			if (!e) printf("OK hash get %s = not found (bucket=%d)\n", a[0], b);
			else printf("OK hash get %s = %s (bucket=%d, steps=%d)\n", a[0], e->val, b, steps);
			return;
		}
		if (!e) { puts("ERR hash: key not found"); return; }
		list_del(&e->list); free(e); hsize--;
		printf("OK hash del %s (size=%d)\n", a[0], hsize);
		return;
	}
	puts("ERR hash: unknown op");
}

/* ---------- binary search tree / AVL ---------- */
static int ht(struct tnode *t) { return t ? t->h : 0; }
static void upd(struct tnode *t) { int a = ht(t->l), b = ht(t->r); t->h = 1 + (a > b ? a : b); }
static struct tnode *rotr(struct tnode *y) { struct tnode *x = y->l; y->l = x->r; x->r = y; upd(y); upd(x); return x; }
static struct tnode *rotl(struct tnode *x) { struct tnode *y = x->r; x->r = y->l; y->l = x; upd(x); upd(y); return y; }
static struct tnode *bal(struct tnode *t)
{
	upd(t);
	int b = ht(t->l) - ht(t->r);
	if (b > 1) { if (ht(t->l->l) < ht(t->l->r)) t->l = rotl(t->l); return rotr(t); }
	if (b < -1) { if (ht(t->r->r) < ht(t->r->l)) t->r = rotr(t->r); return rotl(t); }
	return t;
}
static struct tnode *tins(struct tnode *t, int v, int *dup, int *oom)
{
	if (!t) {
		t = calloc(1, sizeof *t);
		if (!t) { *oom = 1; return NULL; }
		t->val = v; t->h = 1;
		return t;
	}
	if (v < t->val) t->l = tins(t->l, v, dup, oom);
	else if (v > t->val) t->r = tins(t->r, v, dup, oom);
	else *dup = 1;
	return avl ? bal(t) : t;
}
static struct tnode *tdel(struct tnode *t, int v, int *found)
{
	if (!t) return NULL;
	if (v < t->val) t->l = tdel(t->l, v, found);
	else if (v > t->val) t->r = tdel(t->r, v, found);
	else {
		*found = 1;
		if (!t->l || !t->r) { struct tnode *c = t->l ? t->l : t->r; free(t); return c; }
		struct tnode *s = t->r;
		while (s->l) s = s->l;
		t->val = s->val;
		int f2 = 0;
		t->r = tdel(t->r, s->val, &f2);
	}
	return avl ? bal(t) : t;
}
static void tin(struct tnode *t, int *first)
{ if (!t) return; tin(t->l, first); printf("%s%d", *first ? " " : ", ", t->val); *first = 0; tin(t->r, first); }
static int th(struct tnode *t) { if (!t) return 0; int a = th(t->l), b = th(t->r); return 1 + (a > b ? a : b); }
static void tfree(struct tnode *t) { if (!t) return; tfree(t->l); tfree(t->r); free(t); }

static void tree_cmd(const char *op, int na, char **a)
{
    int v, f = 0; char extra[8];
    if (!strcmp(op, "print")) { int first = 1; printf("TREE size=%d height=%d inorder:", ntree, th(root)); if (!ntree) printf(" (empty)"); tin(root, &first); printf("\n"); return; }
    if (sscanf(rest, "%d %7s", &v, extra) != 1) { puts("ERR tree: usage <op> <int>"); return; }
    if (!strcmp(op, "insert")) { root = tins(root, v, &f); if (f) printf("ERR tree: duplicate %d\n", v); else { ntree++; printf("OK tree insert %d (size=%d)\n", v, ntree); } }
    else if (!strcmp(op, "delete")) { root = tdel(root, v, &f); if (!f) printf("ERR tree: %d not found\n", v); else { ntree--; printf("OK tree delete %d (size=%d)\n", v, ntree); } }
    else if (!strcmp(op, "find")) { struct tnode *t = root; while (t && t->val != v) t = v < t->val ? t->l : t->r; printf("OK tree find %d = %s\n", v, t ? "yes" : "no"); }
    else puts("ERR tree: unknown op");
}

int main(int argc, char **argv)
{
    FILE *in = stdin; char line[256], cmd[32], op[32], *rest;
    if (argc > 1 && !(in = fopen(argv[1], "r"))) { fprintf(stderr, "ERR cannot open %s\n", argv[1]); return 2; }
    INIT_LIST_HEAD(&bdays); INIT_LIST_HEAD(&queue); INIT_LIST_HEAD(&stack);
    while (fgets(line, sizeof line, in)) {
        if (!strchr(line, '\n') && !feof(in)) { int c; while ((c = fgetc(in)) != '\n' && c != EOF); puts("ERR line too long"); continue; }
        char *h = strchr(line, '#'); if (h) *h = 0;
        int used = 0; op[0] = 0;
        int k = sscanf(line, "%31s %31s %n", cmd, op, &used);
        if (k < 1) continue;
        if (k == 1) { printf("ERR %s: missing operation\n", cmd); continue; }
        rest = line + used;
        if (!strcmp(cmd, "list")) list_cmd(op, rest);
        else if (!strcmp(cmd, "queue")) seq_cmd("queue", &queue, &nq, 0, op, rest);
        else if (!strcmp(cmd, "stack")) seq_cmd("stack", &stack, &ns, 1, op, rest);
        else if (!strcmp(cmd, "bitmap")) bitmap_cmd(op, rest);
        else if (!strcmp(cmd, "tree")) tree_cmd(op, rest);
        else printf("ERR unknown structure '%s'\n", cmd);
    }
    return 0;
}
