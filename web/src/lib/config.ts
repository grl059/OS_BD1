/**
 * Static catalogue of the seven kernel data structures this app visualizes,
 * plus the command syntax `kds --json` understands for each one. Nothing
 * here is state - it only describes the UI (menu tiles, the command
 * palette in /play, labels in /learn) so those pages don't hard-code text
 * in three different places.
 */
import type { StructureName } from "./model";

export interface OpSpec {
  op: string;
  usage: string; // e.g. "add_tail <day> <month> <year>"
  note: string;
}

export interface StructureSpec {
  id: StructureName;
  title: string; // Mongolian label shown on tiles/headers
  subtitle: string; // one-line English/technical gloss
  kernelRef: string; // the linux/*.h concept this mirrors
  accent: "teal" | "emerald" | "cyan" | "lime" | "teal-dark" | "emerald-dark" | "cyan-dark";
  ops: OpSpec[];
}

export const STRUCTURE_SPECS: Record<StructureName, StructureSpec> = {
  list: {
    id: "list",
    title: "Холбоост жагсаалт",
    subtitle: "doubly linked list",
    kernelRef: "struct list_head (include/linux/list.h)",
    accent: "teal",
    ops: [
      { op: "add_head", usage: "add_head <day> <month> <year>", note: "толгойд нэмэх" },
      { op: "add_tail", usage: "add_tail <day> <month> <year>", note: "сүүлд нэмэх" },
      { op: "find", usage: "find <day> <month> <year>", note: "хайх" },
      { op: "del", usage: "del <day> <month> <year>", note: "устгах" },
      { op: "print", usage: "print", note: "хэвлэх" },
      { op: "clear", usage: "clear", note: "цэвэрлэх" },
    ],
  },
  queue: {
    id: "queue",
    title: "Дараалал (FIFO)",
    subtitle: "queue on list_head",
    kernelRef: "list_add_tail + list_del(head) - FIFO",
    accent: "emerald",
    ops: [
      { op: "push", usage: "push <int>", note: "сүүлд нэмэх" },
      { op: "pop", usage: "pop", note: "толгойгоос авах" },
      { op: "find", usage: "find <int>", note: "хайх" },
      { op: "print", usage: "print", note: "хэвлэх" },
    ],
  },
  stack: {
    id: "stack",
    title: "Стек (LIFO)",
    subtitle: "stack on list_head",
    kernelRef: "list_add + list_del(head) - LIFO",
    accent: "cyan",
    ops: [
      { op: "push", usage: "push <int>", note: "дээр нэмэх" },
      { op: "pop", usage: "pop", note: "дээрээс авах" },
      { op: "find", usage: "find <int>", note: "хайх" },
      { op: "print", usage: "print", note: "хэвлэх" },
    ],
  },
  bitmap: {
    id: "bitmap",
    title: "Битийн массив",
    subtitle: "bitmap",
    kernelRef: "include/linux/bitmap.h",
    accent: "lime",
    ops: [
      { op: "size", usage: "size <1..128>", note: "хэмжээ тохируулах" },
      { op: "set", usage: "set <index>", note: "бит тавих" },
      { op: "clear", usage: "clear <index>", note: "бит арилгах" },
      { op: "test", usage: "test <index>", note: "бит шалгах" },
      { op: "print", usage: "print", note: "хэвлэх" },
    ],
  },
  hash: {
    id: "hash",
    title: "Хэш хүснэгт",
    subtitle: "chained hash map",
    kernelRef: "hlist-style chaining per bucket",
    accent: "teal-dark",
    ops: [
      { op: "put", usage: "put <key> <value>", note: "хадгалах" },
      { op: "get", usage: "get <key>", note: "унших" },
      { op: "del", usage: "del <key>", note: "устгах" },
      { op: "size", usage: "size <1..16>", note: "савны тоо" },
      { op: "print", usage: "print", note: "хэвлэх" },
    ],
  },
  tree: {
    id: "tree",
    title: "Хайлтын мод",
    subtitle: "BST / AVL",
    kernelRef: "rb_tree-style balancing (rotl/rotr)",
    accent: "emerald-dark",
    ops: [
      { op: "mode", usage: "mode <bst|avl>", note: "горим сонгох (хоосон мод дээр)" },
      { op: "insert", usage: "insert <int>", note: "оруулах" },
      { op: "delete", usage: "delete <int>", note: "устгах" },
      { op: "find", usage: "find <int>", note: "хайх" },
      { op: "print", usage: "print", note: "хэвлэх" },
    ],
  },
  sched: {
    id: "sched",
    title: "Процесс & хуваарилагч",
    subtitle: "PCB ready queue - FCFS / Round Robin",
    kernelRef: "struct task_struct ready queue (simplified PCB)",
    accent: "cyan-dark",
    ops: [
      { op: "policy", usage: "policy <fcfs|rr <1..10>>", note: "хуваарилах бодлого" },
      { op: "tick", usage: "tick", note: "1 алхам явуулах" },
      { op: "print", usage: "print", note: "хэвлэх" },
      { op: "clear", usage: "clear", note: "цэвэрлэх" },
    ],
  },
};

/** proc (new process) is created via a different command word than sched. */
export const PROC_NEW: OpSpec = { op: "new", usage: "new <name> <burst 1..20>", note: "процесс үүсгэх" };

export const STRUCTURE_ORDER: StructureName[] = [
  "list",
  "queue",
  "stack",
  "bitmap",
  "hash",
  "tree",
  "sched",
];
