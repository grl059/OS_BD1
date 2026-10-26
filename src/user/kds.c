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
#include <unistd.h>

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
struct node { int val; struct list_head list; };                 /* queue / stack */
struct hentry { char key[13], val[13]; struct list_head list; }; /* hash chain */
struct pcb { int pid, rem, slice, burst; char name[9]; struct list_head list; };
struct tnode { int val, h; struct tnode *l, *r; };

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
	int v, f = 0, oom = 0;
	if (!strcmp(op, "print")) {
		int first = 1;
		printf("TREE%s size=%d height=%d inorder:", avl ? "(avl)" : "", ntree, th(root));
		if (!ntree) printf(" (empty)");
		tin(root, &first);
		printf("\n");
		return;
	}
	if (!strcmp(op, "mode")) {
		if (na != 1 || (strcmp(a[0], "bst") && strcmp(a[0], "avl"))) { puts("ERR tree: mode must be bst or avl"); return; }
		if (ntree) { puts("ERR tree: mode can only be changed when the tree is empty"); return; }
		avl = !strcmp(a[0], "avl");
		printf("OK tree mode %s\n", a[0]);
		return;
	}
	if (na != 1 || !is_int(a[0], &v)) { puts("ERR tree: usage <op> <int>"); return; }
	if (!strcmp(op, "insert")) {
		root = tins(root, v, &f, &oom);
		if (oom) { puts("ERR tree: out of memory"); return; }
		if (f) printf("ERR tree: duplicate %d\n", v);
		else { ntree++; printf("OK tree insert %d (size=%d)\n", v, ntree); }
	} else if (!strcmp(op, "delete")) {
		root = tdel(root, v, &f);
		if (!f) printf("ERR tree: %d not found\n", v);
		else { ntree--; printf("OK tree delete %d (size=%d)\n", v, ntree); }
	} else if (!strcmp(op, "find")) {
		struct tnode *t = root;
		while (t && t->val != v) t = v < t->val ? t->l : t->r;
		printf("OK tree find %d = %s\n", v, t ? "yes" : "no");
	} else puts("ERR tree: unknown op");
}

/* ---------- processes and scheduler (PCB + list_head ready queue) ---------- */
static void sched_reset(void)
{
	free_nodes(&ready, offsetof(struct pcb, list));
	free(running);
	running = NULL;
	quantum = now = ndone = nready = 0;
	nextpid = 1;
}

static void proc_cmd(const char *op, int na, char **a)
{
	int b;
	if (strcmp(op, "new")) { puts("ERR proc: unknown op"); return; }
	if (na != 2 || !is_int(a[1], &b)) { puts("ERR proc: usage new <name> <burst>"); return; }
	if (!is_word(a[0], 8)) { puts("ERR proc: name must be 1..8 letters, digits or _"); return; }
	if (b < 1 || b > 20) { puts("ERR proc: burst must be 1..20"); return; }
	int alive = nready + (running ? 1 : 0);
	if (alive >= LIMIT) { printf("ERR proc: too many processes (limit %d)\n", LIMIT); return; }
	struct pcb *p = malloc(sizeof *p);
	if (!p) { puts("ERR proc: out of memory"); return; }
	p->pid = nextpid++; p->rem = b; p->burst = b; p->slice = 0;
	strcpy(p->name, a[0]);
	list_add_tail(&p->list, &ready);         /* enqueue at the tail */
	nready++;
	printf("OK proc new P%d %s burst=%d (alive=%d)\n", p->pid, p->name, b, alive + 1);
}

static void sched_cmd(const char *op, int na, char **a)
{
	int q;
	struct list_head *p;
	if (!strcmp(op, "policy")) {
		if (na == 1 && !strcmp(a[0], "fcfs")) { quantum = 0; puts("OK sched policy fcfs"); return; }
		if (na == 2 && !strcmp(a[0], "rr") && is_int(a[1], &q) && q >= 1 && q <= 10) {
			quantum = q;
			printf("OK sched policy rr q=%s\n", a[1]);
			return;
		}
		puts("ERR sched: policy must be 'fcfs' or 'rr <quantum 1..10>'");
		return;
	}
	if (!strcmp(op, "tick")) {
		if (!running && !list_empty(&ready)) {   /* dispatch: take the head */
			running = list_entry(ready.next, struct pcb, list);
			list_del(&running->list);
			nready--;
			running->slice = 0;
		}
		if (!running) { printf("TICK t=%d idle\n", now++); return; }
		struct pcb *r = running;
		const char *tag = "";
		r->rem--; r->slice++;
		printf("TICK t=%d P%d(%s) remaining=%d", now++, r->pid, r->name, r->rem);
		if (r->rem == 0) { tag = " finished"; running = NULL; ndone++; free(r); }
		else if (quantum && r->slice >= quantum) {   /* preempt: back to the tail */
			tag = " preempted";
			running = NULL;
			list_add_tail(&r->list, &ready);
			nready++;
		}
		printf("%s\n", tag);
		return;
	}
	if (!strcmp(op, "print")) {
		int first = 1;
		if (quantum) printf("SCHED policy=rr(q=%d) time=%d running=", quantum, now);
		else printf("SCHED policy=fcfs time=%d running=", now);
		if (running) printf("P%d(%s:%d)", running->pid, running->name, running->rem);
		else printf("none");
		printf(" ready=");
		if (list_empty(&ready)) printf("(empty)");
		list_for_each(p, &ready) {
			struct pcb *x = list_entry(p, struct pcb, list);
			printf("%sP%d(%s:%d)", first ? "" : ", ", x->pid, x->name, x->rem);
			first = 0;
		}
		printf(" done=%d\n", ndone);
		return;
	}
	if (!strcmp(op, "clear")) { sched_reset(); puts("OK sched clear"); return; }
	puts("ERR sched: unknown op");
}

/* ---------- JSON event mode (--json), additive: text mode above is untouched ---------- */
static int json_mode;

/* Print s as a JSON string literal, escaping the few bytes that must be
 * escaped. Our own messages never need this (no quotes/backslashes/control
 * bytes in any OK/ERR text), but user-typed args/keys/names could in theory
 * contain anything before validation rejects them, so every string that
 * reaches JSON output goes through here. */
static void putjs(const char *s)
{
	putchar('"');
	for (; *s; s++) {
		unsigned char c = (unsigned char)*s;
		if (c == '"' || c == '\\') { putchar('\\'); putchar((char)c); }
		else if (c < 0x20) printf("\\u%04x", c);
		else putchar((char)c);
	}
	putchar('"');
}

/* Run `call` (one of the 8 dispatch calls in main) and, in json_mode, swap
 * stdout for a throwaway temp file (plain ISO C tmpfile(), not a Linux-only
 * mechanism, so this builds the same on Linux/macOS/MinGW) while it runs,
 * so its text output lands in *out instead of the terminal - none of the 8
 * handler functions are touched or even aware of this. *out is malloc'd
 * (caller frees); NULL means json_mode is off, or the one-time capture
 * setup (dup/tmpfile) failed, in which case `call` still ran normally and
 * printed straight to stdout as if json_mode were off. */
#define JSON_CAPTURE(call, out) do { \
		(out) = NULL; \
		if (!json_mode) { call; break; } \
		fflush(stdout); \
		int real_fd = dup(STDOUT_FILENO); \
		FILE *cap_f = real_fd < 0 ? NULL : tmpfile(); \
		int mfd = cap_f ? fileno(cap_f) : -1; \
		if (mfd < 0) { if (real_fd >= 0) close(real_fd); if (cap_f) fclose(cap_f); call; break; } \
		dup2(mfd, STDOUT_FILENO); \
		call; \
		fflush(stdout); \
		dup2(real_fd, STDOUT_FILENO); \
		close(real_fd); \
		long cap_len = ftell(cap_f); \
		char *cap_buf = cap_len >= 0 ? malloc((size_t)cap_len + 1) : NULL; \
		if (cap_buf) { \
			rewind(cap_f); \
			size_t cap_r = fread(cap_buf, 1, (size_t)cap_len, cap_f); \
			cap_buf[cap_r] = 0; \
			size_t cap_n = strlen(cap_buf); \
			if (cap_n && cap_buf[cap_n - 1] == '\n') cap_buf[cap_n - 1] = 0; \
		} \
		fclose(cap_f); \
		(out) = cap_buf; \
	} while (0)

/* "hot" - which part of the just-updated structure the UI should highlight,
 * read back from the live globals (or, only where that is not meaningfully
 * cheaper, parsed out of the fixed-format message) rather than recomputed
 * by a separate code path. NULL means "nothing to highlight". */
static void emit_hot(const char *cmd, const char *op, int na, char **a, int ok, const char *msg)
{
	struct list_head *p;
	int i = 0, v, pid;
	if (!ok || !msg) { printf("null"); return; }
	if (!strcmp(cmd, "list")) {
		if (!strcmp(op, "add_head")) { printf("{\"idx\":0}"); return; }
		if (!strcmp(op, "add_tail")) { printf("{\"idx\":%d}", nb - 1); return; }
		if (!strcmp(op, "find") && na == 3 && !strstr(msg, "not found")) {
			int d = atoi(a[0]), m = atoi(a[1]), y = atoi(a[2]);
			list_for_each(p, &bdays) {
				struct birthday *b = list_entry(p, struct birthday, list);
				if (b->day == d && b->month == m && b->year == y) { printf("{\"idx\":%d}", i); return; }
				i++;
			}
		}
	} else if (!strcmp(cmd, "queue") || !strcmp(cmd, "stack")) {
		int stk = !strcmp(cmd, "stack");
		if (!strcmp(op, "push")) { printf("{\"idx\":%d}", stk ? 0 : (nq - 1)); return; }
		if (!strcmp(op, "find") && na == 1 && !strstr(msg, "not found")) {
			v = atoi(a[0]);
			list_for_each(p, stk ? &stack : &queue) {
				if (list_entry(p, struct node, list)->val == v) { printf("{\"idx\":%d}", i); return; }
				i++;
			}
		}
	} else if (!strcmp(cmd, "bitmap")) {
		if ((!strcmp(op, "set") || !strcmp(op, "clear") || !strcmp(op, "test")) && na == 1) {
			printf("{\"idx\":%d}", atoi(a[0])); return;
		}
	} else if (!strcmp(cmd, "hash")) {
		if (!strcmp(op, "put") && na == 2) { printf("{\"key\":"); putjs(a[0]); printf("}"); return; }
		if (!strcmp(op, "get") && na == 1 && !strstr(msg, "not found")) {
			printf("{\"key\":"); putjs(a[0]); printf("}"); return;
		}
	} else if (!strcmp(cmd, "tree")) {
		if (!strcmp(op, "insert") && na == 1) { printf("{\"val\":%d}", atoi(a[0])); return; }
		if (!strcmp(op, "find") && na == 1) {
			size_t ml = strlen(msg);
			if (ml >= 3 && !strcmp(msg + ml - 3, "yes")) { printf("{\"val\":%d}", atoi(a[0])); return; }
		}
	} else if (!strcmp(cmd, "proc")) {
		if (!strcmp(op, "new") && nready > 0) {
			struct pcb *last = list_entry(ready.prev, struct pcb, list);
			printf("{\"pid\":%d}", last->pid); return;
		}
	} else if (!strcmp(cmd, "sched")) {
		if (!strcmp(op, "tick") && sscanf(msg, "TICK t=%*d P%d", &pid) == 1) {
			printf("{\"pid\":%d}", pid); return;
		}
	}
	printf("null");
}

/* {"v":...,"l":<rec>,"r":<rec>} or null - same recursion style as tfree/tin
 * above, bounded by how many values a test script can insert (well under
 * any real stack limit). */
static void print_tnode(struct tnode *t)
{
	if (!t) { printf("null"); return; }
	printf("{\"v\":%d,\"l\":", t->val);
	print_tnode(t->l);
	printf(",\"r\":");
	print_tnode(t->r);
	printf("}");
}

/* Full snapshot of every structure, read straight from the same globals the
 * handlers above own - the UI only ever displays this, it never keeps or
 * recomputes state of its own. */
static void emit_state(void)
{
	struct list_head *p;
	int first;

	printf("\"list\":{\"size\":%d,\"items\":[", nb);
	first = 1;
	list_for_each(p, &bdays) {
		struct birthday *b = list_entry(p, struct birthday, list);
		printf("%s[%d,%d,%d]", first ? "" : ",", b->day, b->month, b->year);
		first = 0;
	}
	printf("]},");

	printf("\"queue\":{\"size\":%d,\"items\":[", nq);
	first = 1;
	list_for_each(p, &queue) { printf("%s%d", first ? "" : ",", list_entry(p, struct node, list)->val); first = 0; }
	printf("]},");

	printf("\"stack\":{\"size\":%d,\"items\":[", ns);
	first = 1;
	list_for_each(p, &stack) { printf("%s%d", first ? "" : ",", list_entry(p, struct node, list)->val); first = 0; }
	printf("]},");

	printf("\"bitmap\":{\"n\":%d,\"bits\":[", nbits);
	for (int i = 0; i < nbits; i++) printf("%s%d", i ? "," : "", bits[i]);
	printf("]},");

	printf("\"hash\":{\"n\":%d,\"size\":%d,\"buckets\":[", hn, hsize);
	for (int b = 0; b < hn; b++) {
		printf("%s[", b ? "," : "");
		first = 1;
		list_for_each(p, &buckets[b]) {
			struct hentry *e = list_entry(p, struct hentry, list);
			printf("%s[", first ? "" : ",");
			putjs(e->key); printf(",");
			putjs(e->val); printf("]");
			first = 0;
		}
		printf("]");
	}
	printf("]},");

	printf("\"tree\":{\"avl\":%s,\"size\":%d,\"height\":%d,\"node\":", avl ? "true" : "false", ntree, th(root));
	print_tnode(root);
	printf("},");

	printf("\"sched\":{\"quantum\":%d,\"time\":%d,\"done\":%d,\"running\":", quantum, now, ndone);
	if (running) printf("{\"pid\":%d,\"name\":\"%s\",\"rem\":%d,\"burst\":%d}", running->pid, running->name, running->rem, running->burst);
	else printf("null");
	printf(",\"ready\":[");
	first = 1;
	list_for_each(p, &ready) {
		struct pcb *x = list_entry(p, struct pcb, list);
		printf("%s{\"pid\":%d,\"name\":\"%s\",\"rem\":%d,\"burst\":%d}", first ? "" : ",", x->pid, x->name, x->rem, x->burst);
		first = 0;
	}
	printf("]}");
}

/* ---------- interpreter ---------- */
static void cleanup(void)
{
	free_nodes(&bdays, offsetof(struct birthday, list));
	free_nodes(&queue, offsetof(struct node, list));
	free_nodes(&stack, offsetof(struct node, list));
	hash_reset(hn);
	tfree(root);
	sched_reset();
}

int main(int argc, char **argv)
{
	FILE *in = stdin;
	char line[1024], *tok[MAXTOK];
	const char *path = NULL;
	long step = 0;

	for (int i = 1; i < argc; i++) {
		if (!strcmp(argv[i], "--json")) json_mode = 1;
		else if (!path) path = argv[i];
	}
	if (path && !(in = fopen(path, "r"))) { fprintf(stderr, "ERR cannot open %s\n", path); return 2; }

	INIT_LIST_HEAD(&bdays); INIT_LIST_HEAD(&queue); INIT_LIST_HEAD(&stack); INIT_LIST_HEAD(&ready);
	hash_reset(8);
	if (json_mode) printf("{\"type\":\"start\"}\n");
	while (fgets(line, sizeof line, in)) {
		char *msg = NULL;
		int ok = 1;
		int n = 0;
		int msg_heap = 0;   /* true only when msg came from JSON_CAPTURE's malloc'd buffer */

		if (!strchr(line, '\n') && !feof(in)) {
			int c;
			while ((c = fgetc(in)) != '\n' && c != EOF);
			if (!json_mode) { puts("ERR line too long"); continue; }
			ok = 0; msg = "ERR line too long";
		} else {
			char *h = strchr(line, '#');
			if (h) *h = 0;
			for (char *t = strtok(line, " \t\r\n\v\f"); t; t = strtok(NULL, " \t\r\n\v\f"))
				if (n < MAXTOK) tok[n++] = t; else { n = MAXTOK + 1; break; }
			if (n == 0) continue;
		}

		const char *cmd = msg ? "" : tok[0];
		const char *op = "";
		int na = 0;
		char **a = tok;
		char errbuf[96];

		if (!msg && n == 1) {
			cmd = tok[0];
			if (json_mode) { snprintf(errbuf, sizeof errbuf, "ERR %s: missing operation", cmd); msg = errbuf; ok = 0; }
			else { printf("ERR %s: missing operation\n", cmd); fflush(stdout); step++; continue; }
		} else if (!msg) {
			op = tok[1];
			na = n > MAXTOK ? MAXTOK : n - 2;   /* > MAXTOK tokens: argument count is wrong anyway */
			a = tok + 2;
			int known = 1;
			if (!strcmp(cmd, "list")) JSON_CAPTURE(list_cmd(op, na, a), msg);
			else if (!strcmp(cmd, "queue")) JSON_CAPTURE(seq_cmd("queue", &queue, &nq, 0, op, na, a), msg);
			else if (!strcmp(cmd, "stack")) JSON_CAPTURE(seq_cmd("stack", &stack, &ns, 1, op, na, a), msg);
			else if (!strcmp(cmd, "bitmap")) JSON_CAPTURE(bitmap_cmd(op, na, a), msg);
			else if (!strcmp(cmd, "hash")) JSON_CAPTURE(hash_cmd(op, na, a), msg);
			else if (!strcmp(cmd, "tree")) JSON_CAPTURE(tree_cmd(op, na, a), msg);
			else if (!strcmp(cmd, "proc")) JSON_CAPTURE(proc_cmd(op, na, a), msg);
			else if (!strcmp(cmd, "sched")) JSON_CAPTURE(sched_cmd(op, na, a), msg);
			else known = 0;
			if (known) {
				msg_heap = msg != NULL;   /* JSON_CAPTURE only ever produces NULL or a malloc'd buffer */
			} else if (json_mode) {
				snprintf(errbuf, sizeof errbuf, "ERR unknown structure '%.40s'", cmd); msg = errbuf; ok = 0;
			} else {
				printf("ERR unknown structure '%s'\n", cmd); fflush(stdout); step++; continue;
			}
		}

		if (json_mode) {
			if (msg) ok = ok && strncmp(msg, "ERR", 3) != 0;
			else { msg = ""; ok = 1; }   /* capture setup failed: handler already wrote straight to stdout */
			printf("{\"type\":\"event\",\"t\":%ld,\"cmd\":", step);
			putjs(cmd); printf(",\"op\":"); putjs(op);
			printf(",\"args\":[");
			for (int i = 0; i < na; i++) { printf("%s", i ? "," : ""); putjs(a[i]); }
			printf("],\"ok\":%s,\"msg\":", ok ? "true" : "false");
			putjs(msg);
			printf(",\"hot\":"); emit_hot(cmd, op, na, a, ok, msg);
			printf(",\"state\":{"); emit_state(); printf("}}\n");
			if (msg_heap) free(msg);
		}
		fflush(stdout);
		step++;
	}
	if (json_mode) printf("{\"type\":\"end\",\"steps\":%ld}\n", step);
	if (in != stdin) fclose(in);
	cleanup();
	return 0;
}
