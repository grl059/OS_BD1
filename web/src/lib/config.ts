/**
 * Static catalogue of the seven kernel data structures this app visualizes,
 * plus the command syntax `kds --json` understands for each one. Nothing
 * here is state - it only describes the UI (menu tiles, the friendly
 * action forms in /play, labels in /learn) so those pages don't hard-code
 * text in three different places.
 *
 * Each op's `build()` only formats text the person typed into plain input
 * fields into the exact command words `kds` expects - it does not decide
 * whether that command will succeed. The C core alone makes that call.
 */
import type { StructureName } from "./model";

export interface FieldDef {
  key: string;
  label: string;
  kind: "int" | "text" | "select";
  placeholder?: string;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
}

export interface OpSpec {
  id: string; // unique within a structure's ops list
  cmdWord: string; // first word of the kds command: "list", "queue", "proc", "sched", ...
  verb: string; // friendly Mongolian button label
  fields: FieldDef[];
  build: (v: Record<string, string>) => string; // command text AFTER cmdWord, e.g. "add_tail 2 8 1995"
}

export interface StructureSpec {
  id: StructureName;
  title: string; // Mongolian label shown on tiles/headers
  subtitle: string; // one-line English/technical gloss
  kernelRef: string; // the linux/*.h concept this mirrors
  accent: "teal" | "emerald" | "cyan" | "lime" | "teal-dark" | "emerald-dark" | "cyan-dark";
  emoji: string;
  nickname: string; // playful, jargon-free name for someone who's never coded
  blurb: string; // one or two plain sentences: what is this, in everyday terms
  demoScript: string; // a short script run_script() can hand straight to the C core
  ops: OpSpec[];
}

const dayField: FieldDef = { key: "d", label: "Өдөр", kind: "int", placeholder: "2", min: 1, max: 31 };
const monthField: FieldDef = { key: "m", label: "Сар", kind: "int", placeholder: "8", min: 1, max: 12 };
const yearField: FieldDef = { key: "y", label: "Жил", kind: "int", placeholder: "1995", min: 1900, max: 2100 };
const dateFields: FieldDef[] = [dayField, monthField, yearField];
const dateBuild = (v: Record<string, string>) => `${v.d} ${v.m} ${v.y}`;

const intField = (label: string, placeholder = "5", min?: number, max?: number): FieldDef => ({
  key: "n",
  label,
  kind: "int",
  placeholder,
  min,
  max,
});

export const STRUCTURE_SPECS: Record<StructureName, StructureSpec> = {
  list: {
    id: "list",
    title: "Холбоост жагсаалт",
    subtitle: "doubly linked list",
    kernelRef: "struct list_head (include/linux/list.h)",
    accent: "teal",
    emoji: "🚂",
    nickname: "Галт тэрэг",
    blurb:
      "Вагонууд бие биенээ барьж, нэг эгнээнд залгагдсан галт тэрэг шиг. Вагон бүр зөвхөн хажуугийн хоёр вагоноо мэддэг тул дундаас нь амархан нэмж, салгаж болно.",
    demoScript: [
      "list add_tail 2 8 1995",
      "list add_tail 17 3 1998",
      "list add_tail 29 2 2000",
      "list find 17 3 1998",
      "list del 17 3 1998",
      "list print",
    ].join("\n"),
    ops: [
      {
        id: "add_head",
        cmdWord: "list",
        verb: "Эхэнд нэмэх",
        fields: dateFields,
        build: (v) => `add_head ${dateBuild(v)}`,
      },
      {
        id: "add_tail",
        cmdWord: "list",
        verb: "Сүүлд нэмэх",
        fields: dateFields,
        build: (v) => `add_tail ${dateBuild(v)}`,
      },
      { id: "find", cmdWord: "list", verb: "Хайх", fields: dateFields, build: (v) => `find ${dateBuild(v)}` },
      { id: "del", cmdWord: "list", verb: "Устгах", fields: dateFields, build: (v) => `del ${dateBuild(v)}` },
      { id: "print", cmdWord: "list", verb: "Хэвлэх", fields: [], build: () => "print" },
      { id: "clear", cmdWord: "list", verb: "Цэвэрлэх", fields: [], build: () => "clear" },
    ],
  },
  queue: {
    id: "queue",
    title: "Дараалал (FIFO)",
    subtitle: "queue on list_head",
    kernelRef: "list_add_tail + list_del(head) - FIFO",
    accent: "emerald",
    emoji: "🧍",
    nickname: "Дэлгүүрийн дараалал",
    blurb:
      "Дэлгүүрийн жижүүр шиг: хамгийн түрүүнд ээлжинд зогссон хүн хамгийн түрүүнд үйлчлүүлнэ. Шинэ хүн үргэлж ээлжний төгсгөлд очно (FIFO - First In, First Out).",
    demoScript: ["queue push 10", "queue push 20", "queue push 30", "queue pop", "queue print"].join("\n"),
    ops: [
      {
        id: "push",
        cmdWord: "queue",
        verb: "Ээлжинд орох",
        fields: [intField("Тоо", "10")],
        build: (v) => `push ${v.n}`,
      },
      { id: "pop", cmdWord: "queue", verb: "Эхнийхийг гаргах", fields: [], build: () => "pop" },
      {
        id: "find",
        cmdWord: "queue",
        verb: "Хайх",
        fields: [intField("Тоо", "10")],
        build: (v) => `find ${v.n}`,
      },
      { id: "print", cmdWord: "queue", verb: "Хэвлэх", fields: [], build: () => "print" },
    ],
  },
  stack: {
    id: "stack",
    title: "Стек (LIFO)",
    subtitle: "stack on list_head",
    kernelRef: "list_add + list_del(head) - LIFO",
    accent: "cyan",
    emoji: "🍽️",
    nickname: "Тавагны овоолго",
    blurb:
      "Угаасан тавгийн овоолго шиг: хамгийн сүүлд тавьсан тавгийг хамгийн түрүүнд авна. Доорх тавгийг эхлээд авч болохгүй (LIFO - Last In, First Out).",
    demoScript: ["stack push 10", "stack push 20", "stack push 30", "stack pop", "stack print"].join("\n"),
    ops: [
      {
        id: "push",
        cmdWord: "stack",
        verb: "Дээр нь тавих",
        fields: [intField("Тоо", "10")],
        build: (v) => `push ${v.n}`,
      },
      { id: "pop", cmdWord: "stack", verb: "Дээрээс авах", fields: [], build: () => "pop" },
      {
        id: "find",
        cmdWord: "stack",
        verb: "Хайх",
        fields: [intField("Тоо", "10")],
        build: (v) => `find ${v.n}`,
      },
      { id: "print", cmdWord: "stack", verb: "Хэвлэх", fields: [], build: () => "print" },
    ],
  },
  bitmap: {
    id: "bitmap",
    title: "Битийн массив",
    subtitle: "bitmap",
    kernelRef: "include/linux/bitmap.h",
    accent: "lime",
    emoji: "💡",
    nickname: "Гэрлийн самбар",
    blurb:
      "Жижиг чийдэн бүхий самбар шиг: нүд бүр асаалттай (1) эсвэл унтраалттай (0) байна. Компьютер нөөц (санах ой, диск) чөлөөтэй эсэхийг ийм байдлаар хэмнэлттэй тэмдэглэдэг.",
    demoScript: ["bitmap size 16", "bitmap set 3", "bitmap set 9", "bitmap test 3", "bitmap print"].join("\n"),
    ops: [
      {
        id: "size",
        cmdWord: "bitmap",
        verb: "Хэмжээ тохируулах",
        fields: [intField("Хэмжээ", "16", 1, 128)],
        build: (v) => `size ${v.n}`,
      },
      {
        id: "set",
        cmdWord: "bitmap",
        verb: "Асаах",
        fields: [intField("Индекс", "3", 0)],
        build: (v) => `set ${v.n}`,
      },
      {
        id: "clear",
        cmdWord: "bitmap",
        verb: "Унтраах",
        fields: [intField("Индекс", "3", 0)],
        build: (v) => `clear ${v.n}`,
      },
      {
        id: "test",
        cmdWord: "bitmap",
        verb: "Шалгах",
        fields: [intField("Индекс", "3", 0)],
        build: (v) => `test ${v.n}`,
      },
      { id: "print", cmdWord: "bitmap", verb: "Хэвлэх", fields: [], build: () => "print" },
    ],
  },
  hash: {
    id: "hash",
    title: "Хэш хүснэгт",
    subtitle: "chained hash map",
    kernelRef: "hlist-style chaining per bucket",
    accent: "teal-dark",
    emoji: "🗄️",
    nickname: "Хэш хайрцаг",
    blurb:
      "Шошготой хайрцаг шиг: 'түлхүүр' бичсэн шошгоор хайвал доторх 'утга'-г шууд олдог. Хоёр шошго санамсаргүйгээр ижил хайрцагт орвол (collision) тэнд жижиг жагсаалт үүснэ.",
    demoScript: ["hash size 4", "hash put bob 5678", "hash put ab 7", "hash put ba 8", "hash print"].join("\n"),
    ops: [
      {
        id: "put",
        cmdWord: "hash",
        verb: "Хадгалах",
        fields: [
          { key: "key", label: "Түлхүүр", kind: "text", placeholder: "bob" },
          { key: "value", label: "Утга", kind: "text", placeholder: "5678" },
        ],
        build: (v) => `put ${v.key} ${v.value}`,
      },
      {
        id: "get",
        cmdWord: "hash",
        verb: "Унших",
        fields: [{ key: "key", label: "Түлхүүр", kind: "text", placeholder: "bob" }],
        build: (v) => `get ${v.key}`,
      },
      {
        id: "del",
        cmdWord: "hash",
        verb: "Устгах",
        fields: [{ key: "key", label: "Түлхүүр", kind: "text", placeholder: "bob" }],
        build: (v) => `del ${v.key}`,
      },
      {
        id: "size",
        cmdWord: "hash",
        verb: "Савны тоо",
        fields: [intField("Тоо", "8", 1, 16)],
        build: (v) => `size ${v.n}`,
      },
      { id: "print", cmdWord: "hash", verb: "Хэвлэх", fields: [], build: () => "print" },
    ],
  },
  tree: {
    id: "tree",
    title: "Хайлтын мод",
    subtitle: "BST / AVL",
    kernelRef: "rb_tree-style balancing (rotl/rotr)",
    accent: "emerald-dark",
    emoji: "🌳",
    nickname: "Эрэмбийн мод",
    blurb:
      "Мөчир тус бүрдээ тоо агуулсан мод: зүүн мөчир үргэлж бага, баруун мөчир үргэлж том тоо руу хөтөлдөг тул хайх үйлдэл маш хурдан. 'Тэнцвэржсэн (AVL)' горим модыг хэт нэг тийш сунжрахаас сэргийлнэ.",
    demoScript: [
      "tree mode avl",
      "tree insert 4",
      "tree insert 2",
      "tree insert 6",
      "tree insert 1",
      "tree insert 3",
      "tree insert 5",
      "tree insert 7",
      "tree print",
    ].join("\n"),
    ops: [
      {
        id: "mode",
        cmdWord: "tree",
        verb: "Горим сонгох",
        fields: [
          {
            key: "mode",
            label: "Горим",
            kind: "select",
            options: [
              { value: "bst", label: "Энгийн (BST)" },
              { value: "avl", label: "Тэнцвэржсэн (AVL)" },
            ],
          },
        ],
        build: (v) => `mode ${v.mode}`,
      },
      {
        id: "insert",
        cmdWord: "tree",
        verb: "Оруулах",
        fields: [intField("Тоо", "5")],
        build: (v) => `insert ${v.n}`,
      },
      {
        id: "delete",
        cmdWord: "tree",
        verb: "Устгах",
        fields: [intField("Тоо", "5")],
        build: (v) => `delete ${v.n}`,
      },
      {
        id: "find",
        cmdWord: "tree",
        verb: "Хайх",
        fields: [intField("Тоо", "5")],
        build: (v) => `find ${v.n}`,
      },
      { id: "print", cmdWord: "tree", verb: "Хэвлэх", fields: [], build: () => "print" },
    ],
  },
  sched: {
    id: "sched",
    title: "Процесс & хуваарилагч",
    subtitle: "PCB ready queue - FCFS / Round Robin",
    kernelRef: "struct task_struct ready queue (simplified PCB)",
    accent: "cyan-dark",
    emoji: "🧑‍💻",
    nickname: "Ажлын ээлж",
    blurb:
      "Хэд хэдэн хүн ганц компьютер (CPU) хуваалцаж ажилладаг гэж төсөөлөөрэй. 'FCFS' - ирсэн дараалалаараа дуустал нь ажиллуулна; 'Round Robin' - хүн бүрт жижиг цаг (квант) өгч, ээлжлэн ажиллуулна.",
    demoScript: [
      "sched policy rr 2",
      "proc new A 5",
      "proc new B 3",
      "proc new C 2",
      "sched tick",
      "sched tick",
      "sched tick",
      "sched tick",
      "sched tick",
      "sched print",
    ].join("\n"),
    ops: [
      { id: "policy_fcfs", cmdWord: "sched", verb: "FCFS болгох", fields: [], build: () => "policy fcfs" },
      {
        id: "policy_rr",
        cmdWord: "sched",
        verb: "Round Robin болгох",
        fields: [intField("Квант", "2", 1, 10)],
        build: (v) => `policy rr ${v.n}`,
      },
      {
        id: "proc_new",
        cmdWord: "proc",
        verb: "Процесс үүсгэх",
        fields: [
          { key: "name", label: "Нэр", kind: "text", placeholder: "A" },
          { key: "burst", label: "Ажлын урт", kind: "int", placeholder: "5", min: 1, max: 20 },
        ],
        build: (v) => `new ${v.name} ${v.burst}`,
      },
      { id: "tick", cmdWord: "sched", verb: "1 алхам явуулах", fields: [], build: () => "tick" },
      { id: "print", cmdWord: "sched", verb: "Хэвлэх", fields: [], build: () => "print" },
      { id: "clear", cmdWord: "sched", verb: "Цэвэрлэх", fields: [], build: () => "clear" },
    ],
  },
};

export const STRUCTURE_ORDER: StructureName[] = [
  "list",
  "queue",
  "stack",
  "bitmap",
  "hash",
  "tree",
  "sched",
];
