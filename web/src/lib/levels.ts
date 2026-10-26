/**
 * The guided path shown on /learn and /levels: one Level per structure,
 * each with a short narration, a demo script to run through the real C
 * core (never a reimplementation), and one quiz question to check
 * understanding before moving on.
 */
import type { StructureName } from "./model";

export interface QuizQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export interface Level {
  id: string;
  order: number;
  structure: StructureName;
  title: string;
  narration: string[]; // one paragraph per array entry
  script: string; // fed verbatim to `kds --json` on stdin
  quiz: QuizQuestion;
}

export const LEVELS: Level[] = [
  {
    id: "list",
    order: 1,
    structure: "list",
    title: "1. Холбоост жагсаалт",
    narration: [
      "Линукс кернел дотор struct list_head бүхий давхар холбоост дараалал олон газар ашиглагддаг - жишээ нь процессуудын жагсаалт. Энэ хэсэгт бид төрсөн өдрийн бичлэгийг толгой/сүүлд нэмж, хайж, устгаж харна.",
      "add_head нь толгойд, add_tail нь сүүлд нэмнэ - хоёулаа O(1), учир нь list_head нь prev/next заагчтай тойрог хэлхээ.",
    ],
    script: [
      "list add_tail 15 3 2003",
      "list add_head 1 1 2000",
      "list add_tail 20 6 1999",
      "list find 1 1 2000",
      "list del 20 6 1999",
      "list print",
    ].join("\n"),
    quiz: {
      question: "list add_head нь шинэ элементийг хаана байрлуулдаг вэ?",
      choices: ["Жагсаалтын сүүлд", "Жагсаалтын толгойд", "Эрэмбээр дундуур", "Санамсаргүй байрлалд"],
      correctIndex: 1,
      explanation: "add_head нь list_add()-г ашигладаг тул толгойн ард (хамгийн түрүүнд) байрлана.",
    },
  },
  {
    id: "queue",
    order: 2,
    structure: "queue",
    title: "2. Дараалал (FIFO)",
    narration: [
      "Queue нь list_head дээр баригддаг FIFO (First In, First Out) структур: push нь сүүлд нэмнэ, pop нь толгойгоос авна. Процессын зурвасын сан, I/O хүлээлгийн жагсаалт зэрэг кернелийн олон хэсэгт яг энэ зарчим ажилладаг.",
    ],
    script: ["queue push 10", "queue push 20", "queue push 30", "queue pop", "queue print"].join("\n"),
    quiz: {
      question: "queue push 10; queue push 20; queue pop гүйцэтгэвэл ямар утга буцах вэ?",
      choices: ["20", "10", "null", "алдаа"],
      correctIndex: 1,
      explanation: "FIFO учир хамгийн түрүүнд нэмэгдсэн 10 эхлээд гарна.",
    },
  },
  {
    id: "stack",
    order: 3,
    structure: "stack",
    title: "3. Стек (LIFO)",
    narration: [
      "Stack нь мөн list_head дээр баригддаг, гэхдээ push ба pop хоёулаа толгойн зүгт ажилладаг тул LIFO (Last In, First Out) болно. Функц дуудлагын стек, interrupt context хадгалах зэрэгт энэ зарчим хэрэглэгддэг.",
    ],
    script: ["stack push 10", "stack push 20", "stack push 30", "stack pop", "stack print"].join("\n"),
    quiz: {
      question: "stack push 10; stack push 20; stack pop гүйцэтгэвэл ямар утга буцах вэ?",
      choices: ["10", "20", "30", "алдаа"],
      correctIndex: 1,
      explanation: "LIFO учир хамгийн сүүлд нэмэгдсэн 20 эхлээд гарна.",
    },
  },
  {
    id: "bitmap",
    order: 4,
    structure: "bitmap",
    title: "4. Битийн массив",
    narration: [
      "Кернел дотор CPU/хуудасны боломжтой байдлыг нэг битээр тэмдэглэх маш түгээмэл: include/linux/bitmap.h. Энд n бит (анхдагчаар 32) байх ба set/clear/test O(1) ажилладаг.",
    ],
    script: ["bitmap size 16", "bitmap set 3", "bitmap set 7", "bitmap test 3", "bitmap clear 3", "bitmap print"].join(
      "\n",
    ),
    quiz: {
      question: "bitmap size 16 дараа index 16-д set хийвэл юу болох вэ?",
      choices: [
        "Амжилттай тавигдана",
        "ERR: индекс хязгаараас гадна (0..15)",
        "Автоматаар хэмжээ нэмэгдэнэ",
        "Хамгийн сүүлийн бит дээр бичигдэнэ",
      ],
      correctIndex: 1,
      explanation: "Хүчинтэй индекс 0..n-1 (энд 0..15), 16 нь хязгаараас гадна тул ERR.",
    },
  },
  {
    id: "hash",
    order: 5,
    structure: "hash",
    title: "5. Хэш хүснэгт",
    narration: [
      "Хэш хүснэгт түлхүүрийг hfun()-р savны дугаар болгон хувиргаж, мөргөлдсөн тохиолдолд list_head-р хэлхдэг (chaining). Савны тоог нэмэгдүүлбэл мөргөлдөх магадлал буурна.",
    ],
    script: ["hash size 8", "hash put alice 10", "hash put bob 20", "hash get alice", "hash del bob", "hash print"].join(
      "\n",
    ),
    quiz: {
      question: "Хоёр өөр түлхүүр нэг сав руу унавал (collision) kds яаж шийддэг вэ?",
      choices: [
        "Хоёр дахь түлхүүрийг татгалзана",
        "Дараагийн хоосон сав руу шилжүүлнэ (linear probing)",
        "Тэр сав дотроо list_head-р хэлхнэ (chaining)",
        "Хүснэгтийн хэмжээг автоматаар нэмэгдүүлнэ",
      ],
      correctIndex: 2,
      explanation: "hash_cmd нь list_add_tail(&e->list, &buckets[b]) ашиглаж chaining хийдэг.",
    },
  },
  {
    id: "tree",
    order: 6,
    structure: "tree",
    title: "6. Хайлтын мод (BST / AVL)",
    narration: [
      "Энгийн BST муу тохиолдолд (эрэмбээрэй утга оруулахад) жагсаалт шиг O(n) өндэртэй болдог. AVL горимд (tree mode avl) оруулах/устгах бүрт тэнцвэржилт (rotl/rotr) хийгдэж өндөр O(log n)-д хадгалагдана.",
      "mode зөвхөн мод хоосон байхад л өөрчлөгдөх боломжтой.",
    ],
    script: ["tree mode avl", "tree insert 5", "tree insert 3", "tree insert 8", "tree insert 1", "tree print"].join(
      "\n",
    ),
    quiz: {
      question: "tree mode зөвхөн ямар тохиолдолд өөрчлөгдөх боломжтой вэ?",
      choices: ["Үргэлж", "Мод хоосон үед", "Зөвхөн нэг удаа", "Хэзээ ч өөрчлөгдөхгүй"],
      correctIndex: 1,
      explanation: "ntree > 0 бол 'mode can only be changed when the tree is empty' гэсэн ERR гарна.",
    },
  },
  {
    id: "sched",
    order: 7,
    structure: "sched",
    title: "7. Процесс & хуваарилагч",
    narration: [
      "proc new нь шинэ PCB үүсгэж ready дараалалд сүүлд нэмнэ. sched policy fcfs/rr нь бодлого сонгоно, sched tick нь цагийн нэг алхам (quantum) явуулж, RR-д quantum дүүрэхэд процессыг ready-гийн сүүлд буцаана (preempt).",
    ],
    script: [
      "proc new alpha 3",
      "proc new beta 2",
      "sched policy rr 2",
      "sched tick",
      "sched tick",
      "sched tick",
      "sched print",
    ].join("\n"),
    quiz: {
      question: "Round Robin (quantum=2) дээр процесс өөрийн quantum-гаа дуусгаад ажил дуусаагүй бол юу болох вэ?",
      choices: [
        "Үргэлжлүүлж ажиллана",
        "ready дараалалын сүүлд буцаж, дараагийн процесс ажиллана (preempted)",
        "Хэрэглэгч алдаа заана",
        "Процесс устгагдана",
      ],
      correctIndex: 1,
      explanation: "r->slice >= quantum үед 'preempted' гэж тэмдэглэгдэж ready-гийн сүүлд буцна.",
    },
  },
];

export function levelById(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function nextLevel(id: string): Level | undefined {
  const cur = levelById(id);
  if (!cur) return undefined;
  return LEVELS.find((l) => l.order === cur.order + 1);
}
