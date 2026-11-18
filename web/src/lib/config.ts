/**
 * Static catalogue of the nine kernel data structures this app visualizes,
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
  accent: "teal" | "emerald" | "cyan" | "lime" | "teal-dark" | "emerald-dark" | "cyan-dark" | "red" | "amber";
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
  rb: {
    id: "rb",
    title: "Улаан-хар мод",
    subtitle: "red-black tree",
    kernelRef: "struct rb_root / rb_node (include/linux/rbtree.h)",
    accent: "red",
    emoji: "🔴",
    nickname: "Өнгөөр тэнцвэржих мод",
    blurb:
      "Хайлтын мод, гэхдээ зангилаа бүр улаан эсвэл хар өнгөтэй. Өнгөний энгийн дүрмүүдийг сахисноор мод хэзээ ч хэт нэг тийш хазайхгүй (Linux кернел өөрөө үүнийг ашигладаг). Оруулах бүрт хэдэн эргүүлэлт хийснийг харж болно.",
    demoScript: [
      "rb insert 1",
      "rb insert 2",
      "rb insert 3",
      "rb insert 4",
      "rb insert 5",
      "rb insert 6",
      "rb print",
    ].join("\n"),
    ops: [
      { id: "insert", cmdWord: "rb", verb: "Оруулах", fields: [intField("Тоо", "5")], build: (v) => `insert ${v.n}` },
      { id: "delete", cmdWord: "rb", verb: "Устгах", fields: [intField("Тоо", "5")], build: (v) => `delete ${v.n}` },
      { id: "find", cmdWord: "rb", verb: "Хайх", fields: [intField("Тоо", "5")], build: (v) => `find ${v.n}` },
      { id: "print", cmdWord: "rb", verb: "Хэвлэх", fields: [], build: () => "print" },
      { id: "clear", cmdWord: "rb", verb: "Цэвэрлэх", fields: [], build: () => "clear" },
    ],
  },
  heap: {
    id: "heap",
    title: "Хамгийн бага овоо",
    subtitle: "min-heap / priority queue",
    kernelRef: "priority queue (array heap, parent i -> 2i+1, 2i+2)",
    accent: "amber",
    emoji: "⛰️",
    nickname: "Тэргүүлэх ээлж",
    blurb:
      "Хамгийн бага тоо үргэлж оройд байдаг овоо. Шинэ тоо оруулахад бусадтайгаа харьцуулж 'дээш өөрөө гарна'; оройг авахад дараагийн хамгийн бага нь өөрөө орой руу гарч ирнэ. Ээлжийн тэргүүлэх дарааллыг ингэж гаргадаг.",
    demoScript: [
      "heap push 5",
      "heap push 3",
      "heap push 8",
      "heap push 1",
      "heap peek",
      "heap pop",
      "heap print",
    ].join("\n"),
    ops: [
      { id: "push", cmdWord: "heap", verb: "Оруулах", fields: [intField("Тоо", "5")], build: (v) => `push ${v.n}` },
      { id: "pop", cmdWord: "heap", verb: "Хамгийн багыг гаргах", fields: [], build: () => "pop" },
      { id: "peek", cmdWord: "heap", verb: "Оройг харах", fields: [], build: () => "peek" },
      { id: "print", cmdWord: "heap", verb: "Хэвлэх", fields: [], build: () => "print" },
      { id: "clear", cmdWord: "heap", verb: "Цэвэрлэх", fields: [], build: () => "clear" },
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
      { id: "stats", cmdWord: "sched", verb: "Дундаж хүлээлт", fields: [], build: () => "stats" },
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
  "rb",
  "heap",
  "sched",
];

/**
 * Plain-Mongolian explanations for the English ERR lines the C core prints.
 * The core's own wording is never changed (tests and the text/JSON
 * equivalence check depend on it); the UI just shows this next to it, so a
 * beginner learns *why* a command was refused and what to type instead.
 */
const ERR_RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^ERR too many tokens/, () => "Нэг мөрөнд хамгийн ихдээ 16 үг (команд, үйлдэл + 14 утга) байж болно. Мөрийг богиносгоно уу."],
  [/^ERR line too long/, () => "Мөр хэт урт байна (1023 тэмдэгтээс бага байх ёстой)."],
  [/^ERR unknown structure '(.*)'/, (m) => `«${m[1]}» гэдэг бүтэц байхгүй. Боломжтой нь: list, queue, stack, bitmap, hash, tree, rb, heap, proc, sched.`],
  [/^ERR (\w+): missing operation/, (m) => `«${m[1]}»-ийн дараа үйлдлийн нэр бичнэ үү (жишээ нь: ${m[1]} print).`],
  [/^ERR (\w+): unknown op/, (m) => `«${m[1]}» бүтэцэд ийм үйлдэл алга. Зүүн талын товчнуудаас сонгоно уу.`],
  [/^ERR (\w+): integer out of range/, () => "Тоо хэт том байна. Зөвхөн -2147483647-оос 2147483647 хүртэлх бүхэл тоо оруулна."],
  [/^ERR list: day out of range for month/, () => "Тухайн сард ийм өдөр байхгүй (жишээ нь 4 сард 31, 2 сард 30 өдөр байхгүй)."],
  [/^ERR list: month must be/, () => "Сар 1-ээс 12 хооронд байна."],
  [/^ERR list: year must be/, () => "Жил 1900-аас 2100 хооронд байна."],
  [/^ERR list: date must be 3 numbers/, () => "Огноог «өдөр сар жил» гэж зайгаар тусгаарласан гурван тоогоор бичнэ (2 8 1995), «2/8/1995» гэж бичиж болохгүй."],
  [/^ERR list: usage/, () => "Огноо гурван бүхэл тоо байх ёстой: өдөр, сар, жил (жишээ нь: list add_tail 2 8 1995)."],
  [/^ERR list: \d+\/\d+\/\d+ not found/, () => "Жагсаалтад энэ огноо олдсонгүй."],
  [/^ERR (queue|stack|heap): underflow|^ERR heap: empty/, () => "Хоосон байна - авах зүйл алга. Эхлээд push хийнэ үү."],
  [/^ERR (queue|stack|heap): overflow/, () => "Бүтэц дүүрсэн (хязгаараа хүрсэн). Эхлээд pop хийж зай гаргана уу."],
  [/^ERR (queue|stack|heap|tree|rb): usage/, () => "Энэ үйлдэлд нэг бүхэл тоо хэрэгтэй (жишээ нь: push 5)."],
  [/^ERR bitmap: index/, () => "Битийн дугаар хүчинтэй хүрээнээс гарсан. Эхлээд «size»-аар хэмжээгээ өгч, 0..(size-1) дотор сонгоно уу."],
  [/^ERR bitmap: size/, () => "Битийн тоо 1-ээс 128 хооронд байна."],
  [/^ERR bitmap: usage/, () => "Битийн дугаар (бүхэл тоо) оруулна уу."],
  [/^ERR hash: (key and value|key) must be/, () => "Түлхүүр, утга 1-12 тэмдэгт; зөвхөн латин үсэг, тоо, доогуур зураас (_). Кирилл, зай, тусгай тэмдэгт болохгүй."],
  [/^ERR hash: key not found/, () => "Ийм түлхүүр хүснэгтэд алга."],
  [/^ERR hash: full/, () => "Хэш хүснэгт дүүрсэн."],
  [/^ERR hash: (rehash )?buckets must be/, () => "Сав (bucket)-ын тоо 1-ээс 16 (rehash-д 64) хооронд байна."],
  [/^ERR hash: usage/, () => "Командын хэлбэр буруу. Жишээ: hash put bob 5678, hash get bob."],
  [/^ERR (tree|rb): duplicate/, () => "Энэ утга модонд аль хэдийн байна - давхардсан утга оруулахгүй."],
  [/^ERR (tree|rb): \S+ not found/, () => "Модонд ийм утга алга."],
  [/^ERR tree: mode can only/, () => "BST/AVL горимыг зөвхөн мод хоосон үед солино. Эхлээд бүх утгыг устгана уу."],
  [/^ERR tree: mode must/, () => "Горим нь bst эсвэл avl байна."],
  [/^ERR proc: name must/, () => "Процессын нэр 1-8 тэмдэгт; латин үсэг, тоо, _ ."],
  [/^ERR proc: burst must/, () => "Ажлын урт 1-ээс 20 хооронд байна."],
  [/^ERR proc: too many/, () => "Нэгэн зэрэг амьд процесс хамгийн ихдээ 8. Зарим нь дуустал «1 алхам явуулах» дарна уу."],
  [/^ERR proc: usage/, () => "Жишээ: proc new A 5 (нэр, ажлын урт)."],
  [/^ERR sched: policy/, () => "Бодлого нь «fcfs» эсвэл «rr 1..10» (квант 1-ээс 10) байна."],
  [/out of memory/, () => "Санах ой хүрэлцсэнгүй."],
];

/** Plain-Mongolian reason for an `ERR ...` message, or null for anything that is not an error. */
export function explainErr(msg: string): string | null {
  if (!msg.startsWith("ERR")) return null;
  for (const [re, f] of ERR_RULES) {
    const m = msg.match(re);
    if (m) return f(m);
  }
  return "Команд хүлээн авагдсангүй. Үйлдлийн товчоор дахин оролдоно уу.";
}
