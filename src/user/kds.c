/* kds.c - User-space replica of Linux kernel data structures (list_head,
 * FIFO queue, LIFO stack, bitmap, binary search tree) driven by a tiny
 * command language. The list part follows include/linux/list.h semantics.
 * Reads commands from stdin (or a file given as argv[1]). */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stddef.h>

#define container_of(ptr, type, m) ((type *)((char *)(ptr) - offsetof(type, m)))

struct list_head { struct list_head *next, *prev; };
static void INIT_LIST_HEAD(struct list_head *h) { h->next = h->prev = h; }
static void __list_add(struct list_head *n, struct list_head *p, struct list_head *x)
{ x->prev = n; n->next = x; n->prev = p; p->next = n; }
static void list_add(struct list_head *n, struct list_head *h) { __list_add(n, h, h->next); }
static void list_add_tail(struct list_head *n, struct list_head *h) { __list_add(n, h->prev, h); }
static void list_del(struct list_head *e) { e->prev->next = e->next; e->next->prev = e->prev; e->next = e->prev = NULL; }
static int list_empty(const struct list_head *h) { return h->next == h; }
#define list_for_each(pos, head) for (pos = (head)->next; pos != (head); pos = pos->next)

struct birthday { int day, month, year; struct list_head list; };
struct node { int val; struct list_head list; };   /* queue / stack node */
struct tnode { int val; struct tnode *l, *r; };

#define LIMIT 8      /* capacity of queue and stack */
#define MAXBITS 128
static struct list_head bdays, queue, stack;
static int nb, nq, ns;
static unsigned char bits[MAXBITS]; static int nbits = 32;
static struct tnode *root; static int ntree;

static int valid_date(int d, int m, int y, const char **why)
{
    static const int dm[] = {31,28,31,30,31,30,31,31,30,31,30,31};
    if (y < 1900 || y > 2100) { *why = "year must be 1900..2100"; return 0; }
    if (m < 1 || m > 12) { *why = "month must be 1..12"; return 0; }
    int lim = dm[m-1] + (m == 2 && ((y%4==0 && y%100) || y%400==0));
    if (d < 1 || d > lim) { *why = "day out of range for month"; return 0; }
    return 1;
}

static void list_cmd(const char *op, char *rest)
{
    int d, m, y; const char *why;
    if (!strcmp(op, "print")) {
        struct list_head *p; printf("LIST size=%d:", nb);
        if (!nb) printf(" (empty)");
        int first = 1;
        list_for_each(p, &bdays) { struct birthday *b = container_of(p, struct birthday, list);
            printf("%s%d/%d/%d", first ? " " : " -> ", b->day, b->month, b->year); first = 0; }
        printf("\n"); return;
    }
    if (!strcmp(op, "clear")) {
        while (!list_empty(&bdays)) { struct birthday *b = container_of(bdays.next, struct birthday, list); list_del(&b->list); free(b); }
        nb = 0; puts("OK list clear (size=0)"); return;
    }
    int addh = !strcmp(op, "add_head"), addt = !strcmp(op, "add_tail"), del = !strcmp(op, "del");
    if (!addh && !addt && !del) { puts("ERR list: unknown op"); return; }
    char extra[8];
    if (sscanf(rest, "%d %d %d %7s", &d, &m, &y, extra) != 3) { puts("ERR list: usage <op> <day> <month> <year>"); return; }
    if (!valid_date(d, m, y, &why)) { printf("ERR list: %s\n", why); return; }
    if (del) {
        struct list_head *p;
        list_for_each(p, &bdays) { struct birthday *b = container_of(p, struct birthday, list);
            if (b->day == d && b->month == m && b->year == y) { list_del(p); free(b); nb--;
                printf("OK list del %d/%d/%d (size=%d)\n", d, m, y, nb); return; } }
        printf("ERR list: %d/%d/%d not found\n", d, m, y); return;
    }
    struct birthday *b = malloc(sizeof *b); b->day = d; b->month = m; b->year = y;
    if (addh) list_add(&b->list, &bdays); else list_add_tail(&b->list, &bdays);
    nb++; printf("OK list %s %d/%d/%d (size=%d)\n", op, d, m, y, nb);
}

static void seq_cmd(const char *name, struct list_head *h, int *n, int lifo, const char *op, char *rest)
{
    if (!strcmp(op, "push")) {
        int v; char extra[8];
        if (sscanf(rest, "%d %7s", &v, extra) != 1) { printf("ERR %s: usage push <int>\n", name); return; }
        if (*n >= LIMIT) { printf("ERR %s: overflow (limit %d)\n", name, LIMIT); return; }
        struct node *x = malloc(sizeof *x); x->val = v;
        if (lifo) list_add(&x->list, h); else list_add_tail(&x->list, h);
        (*n)++; printf("OK %s push %d (size=%d)\n", name, v, *n);
    } else if (!strcmp(op, "pop")) {
        if (list_empty(h)) { printf("ERR %s: underflow (empty)\n", name); return; }
        struct node *x = container_of(h->next, struct node, list); int v = x->val;
        list_del(&x->list); free(x); (*n)--; printf("OK %s pop %d (size=%d)\n", name, v, *n);
    } else if (!strcmp(op, "print")) {
        struct list_head *p; int first = 1; printf("%s size=%d:", lifo ? "STACK(top first)" : "QUEUE(front first)", *n);
        if (!*n) printf(" (empty)");
        list_for_each(p, h) { printf("%s%d", first ? " " : ", ", container_of(p, struct node, list)->val); first = 0; }
        printf("\n");
    } else printf("ERR %s: unknown op\n", name);
}

static void bitmap_cmd(const char *op, char *rest)
{
    int i; char extra[8];
    if (!strcmp(op, "size")) {
        if (sscanf(rest, "%d %7s", &i, extra) != 1 || i < 1 || i > MAXBITS) { printf("ERR bitmap: size must be 1..%d\n", MAXBITS); return; }
        nbits = i; memset(bits, 0, sizeof bits); printf("OK bitmap size %d\n", i); return;
    }
    if (!strcmp(op, "print")) {
        int c = 0; printf("BITMAP n=%d: ", nbits);
        for (i = 0; i < nbits; i++) { putchar('0' + bits[i]); c += bits[i]; }
        printf(" (set=%d)\n", c); return;
    }
    if (!strcmp(op, "set") || !strcmp(op, "clear") || !strcmp(op, "test")) {
        if (sscanf(rest, "%d %7s", &i, extra) != 1) { puts("ERR bitmap: usage <op> <index>"); return; }
        if (i < 0 || i >= nbits) { printf("ERR bitmap: index %d out of range 0..%d\n", i, nbits - 1); return; }
        if (op[0] == 't') { printf("OK bitmap test %d = %d\n", i, bits[i]); return; }
        bits[i] = (op[0] == 's'); printf("OK bitmap %s %d\n", op, i); return;
    }
    puts("ERR bitmap: unknown op");
}

static struct tnode *tins(struct tnode *t, int v, int *dup)
{ if (!t) { t = calloc(1, sizeof *t); t->val = v; return t; }
  if (v < t->val) t->l = tins(t->l, v, dup); else if (v > t->val) t->r = tins(t->r, v, dup); else *dup = 1; return t; }
static struct tnode *tdel(struct tnode *t, int v, int *found)
{ if (!t) return NULL;
  if (v < t->val) t->l = tdel(t->l, v, found); else if (v > t->val) t->r = tdel(t->r, v, found);
  else { *found = 1;
    if (!t->l || !t->r) { struct tnode *c = t->l ? t->l : t->r; free(t); return c; }
    struct tnode *s = t->r; while (s->l) s = s->l; t->val = s->val; int f2 = 0; t->r = tdel(t->r, s->val, &f2); }
  return t; }
static void tin(struct tnode *t, int *first) { if (!t) return; tin(t->l, first); printf("%s%d", *first ? " " : ", ", t->val); *first = 0; tin(t->r, first); }
static int th(struct tnode *t) { if (!t) return 0; int a = th(t->l), b = th(t->r); return 1 + (a > b ? a : b); }

static void tree_cmd(const char *op, char *rest)
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
