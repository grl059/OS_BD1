/**
 * The guided path shown on /learn (and its sidebar level list): one Level per structure,
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

/**
 * One guided step in a level: the exact command fed to `kds --json` and the
 * tutor's plain-language line spoken BEFORE it runs, so /learn reads like a
 * person walking you through one action at a time. `steps.map(s => s.cmd)`
 * must equal `script` (enforced by levels.test.ts).
 */
export interface Step {
  cmd: string;
  say: string;
}

export interface Level {
  id: string;
  order: number;
  structure: StructureName;
  title: string;
  narration: string[]; // one paragraph per array entry
  script: string; // fed verbatim to `kds --json` on stdin
  steps: Step[]; // guided walkthrough of the same script, one line at a time
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
    steps: [
      {
        cmd: "list add_tail 15 3 2003",
        say: "Эхлээд анхны төрсөн өдрийг (15/3/2003) сүүлд нь - add_tail - нэмье. Жагсаалт хоосон байхад энэ нь цорын ганц элемент болно.",
      },
      {
        cmd: "list add_head 1 1 2000",
        say: "Одоо add_head ашиглаж толгойд (хамгийн урд) нэг бичлэг нэмье. Вагон залгахтай адил: хамгийн түрүүний урд шинэ вагон орно.",
      },
      {
        cmd: "list add_tail 20 6 1999",
        say: "Дахиад сүүлд нэг бичлэг нэмье. Анхаараад үз дээ: 1999 он хамгийн эхэнд бичигдсэн ч эрэмбэлэгдэхгүй - жагсаалт орсон дарааллаараа л явна.",
      },
      {
        cmd: "list find 1 1 2000",
        say: "Одоо find-ээр бичлэг хайж үзье. Линукс кернел ч процессоо жагсаалтаас яг ийм зарчимаар хайдаг.",
      },
      {
        cmd: "list del 20 6 1999",
        say: "Устгая. Жагсаалт хоёр талаараа холбогдсон (doubly linked) тул дундаас нэг элементийг салгахад хажуугийнх нь заагчууд л дахин холбогдоно.",
      },
      {
        cmd: "list print",
        say: "Эцэст нь бүхэлд нь хэвлэе. Эцсийн дарааллыг дээрх дүрслэлээс шалгаарай.",
      },
    ],
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
    steps: [
      {
        cmd: "queue push 10",
        say: "Дараалал (queue) нэг л зарчимтай: шинэ элементийг зөвхөн АРД нь нэмнэ. 10 гэдэг тоог ээлжинд оруулъя.",
      },
      {
        cmd: "queue push 20",
        say: "20 ирлээ. Дарааллын дүрмийн дагуу энэ нь 10-ын АРД зогсоно - дунд, эсвэл урд орохгүй.",
      },
      {
        cmd: "queue push 30",
        say: "30 ч сүүлд нэмэгдлээ. Дараалал одоо 10, 20, 30 гэсэн дараалалтай боллоо.",
      },
      {
        cmd: "queue pop",
        say: "Одоо pop хийе. pop ЮУ Ч БИШ, зөвхөн ТОЛГОЙН элементийг - 10-ыг авна. Хамгийн түрүүнд ирсэн нь хамгийн түрүүнд гарна: энэ бол FIFO (First In, First Out).",
      },
      {
        cmd: "queue print",
        say: "Үлдсэн дараалал 20, 30. Кернел дэхь процессын дараалал ч яг ийм зарчимаар ажилладаг.",
      },
    ],
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
    steps: [
      {
        cmd: "stack push 10",
        say: "Стек - угаасан тавгийн овоолготой адил. Эхний таваг - 10 - дээр тавьлаа.",
      },
      {
        cmd: "stack push 20",
        say: "Дараагийн таваг 20-ыг дээр нь тавьлаа. Овоолгын дунд, доор оруулах боломжгүй.",
      },
      {
        cmd: "stack push 30",
        say: "30 хамгийн дээр тавигдлаа. Авах бол зөвхөн хамгийн дээд тавгийг авч болно.",
      },
      {
        cmd: "stack pop",
        say: "pop хамгийн дээрх 30-ыг авлаа. Хамгийн сүүлд тавьсан нь хамгийн түрүүнд гарна: энэ бол LIFO (Last In, First Out). Функц дуудлагын стек ч ингэж ажилладаг.",
      },
      {
        cmd: "stack print",
        say: "Овоолгод 10, 20 хоёр л үлдлээ. Дараагийн pop заавал 20-ыг авна.",
      },
    ],
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
    steps: [
      {
        cmd: "bitmap size 16",
        say: "16 нүдтэй самбар үүсгэе. Нүд бүрийг кернел нэг битээр хадгалдаг тул энэ нь ердөө 2 байт санах ой шаарддаг - маш хэмнэлттэй.",
      },
      {
        cmd: "bitmap set 3",
        say: "3-р нүдийг асаая. Анхаараарай: индекс 0-ээс эхэлдэг. Шууд 3-р бит рүүгээ очно - set нь O(1).",
      },
      {
        cmd: "bitmap set 7",
        say: "7-р нүдийг ч асаая. Самбар дээр хоёр гэрэл асаалaa.",
      },
      {
        cmd: "bitmap test 3",
        say: "test 3 гэхэд 1 гэж хариулна - нүд асаалттай байна. Кернел дискний блок чөлөөтэй эсэхийг яг ийм шиг байдлаар асуудаг.",
      },
      {
        cmd: "bitmap clear 3",
        say: "Одоо 3-р нүдийг унтраая. Утга нь 1-ээс 0 болно.",
      },
      {
        cmd: "bitmap print",
        say: "Эцсийн байдал: зөвхөн 7-р нүд асаалттай. Их агуулга багтаамжтай, бодит кернелийн шийдэл болох include/linux/bitmap.h энэ зарчим дээр тулгуурладаг.",
      },
    ],
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
    steps: [
      {
        cmd: "hash size 8",
        say: "Эхлээд 8 хайрцагтай шүүгээ бэлдье. Савны тоог оруулахаас өмнө тогтоох хэрэгтэй - дараа нь өөрчлөх боломжгүй.",
      },
      {
        cmd: "hash put alice 10",
        say: "'alice' түлхүүрийг хэш функц hfun()-ээр тоо болгож, тохирох хайрцагт хадгалъя. Ямар хайрцагт орсныг дүрслэлээс хар.",
      },
      {
        cmd: "hash put bob 20",
        say: "'bob'-ыг хадгалая. 'bob' hfun('bob') хайрцагт орно - 'alice'-ээс өөр байж ч болох, харин хоёулаа нэг хайрцагт ч орж болно (collision).",
      },
      {
        cmd: "hash get alice",
        say: "get alice гэхэд шууд 10 гэж буцна - бүх жагсаалтыг нэг нэгээр шалгахгүйгээр. Иймд хэш хайлт хурдан байдаг.",
      },
      {
        cmd: "hash del bob",
        say: "bob-ыг устгая. Доторх жижиг жагсаалтаас нь салгагдана.",
      },
      {
        cmd: "hash print",
        say: "Үлдсэн хайрцагнуудыг хар. Мөргөлдсөн тохиолдолд нэг хайрцаг дотроо жагсаалт (chain) үүсдэг гэдгийг анхаараарай.",
      },
    ],
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
    steps: [
      {
        cmd: "tree mode avl",
        say: "Эхлэхээс өмнө горим сонгоно. AVL - тэнцвэржсэн мод: мод хоосон байх үед л горимыг өөрчлөх боломжтой гэдгийг санаарай.",
      },
      {
        cmd: "tree insert 5",
        say: "Эхний тоо 5 модны үндэс (root) болно. Мод одоо зөвхөн нэг мөчиртэй.",
      },
      {
        cmd: "tree insert 3",
        say: "3, 5-аас бага тул ЗҮҮН мөчир рүү очно. Хайлтын модны алтан дүрэм: зүүн < эцэг < баруун.",
      },
      {
        cmd: "tree insert 8",
        say: "8, 5-аас их тул БАРУУН мөчир рүү очно. Одоо мод тэнхэгтэй харагдаж байна.",
      },
      {
        cmd: "tree insert 1",
        say: "1 хамгийн зүүн талд очно. Хэрэв мод нэг тийшээ хэт хазайвал AVL өөрөө эргүүлэлт (rotation) хийж тэнцвэржүүлнэ - чи үүнийг дүрслэл дээр ажиглаарай.",
      },
      {
        cmd: "tree print",
        say: "Эцсийн мод. Өндөр O(log n) хэвээр үлдсэн тул 1 сая элементтэй ч хайхад ердөө ~20 алхам л хэрэгтэй.",
      },
    ],
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
    steps: [
      {
        cmd: "proc new alpha 3",
        say: "alpha нэртэй процесс үүслээ. Ажлаа дуусгахад нь 3 цаг (burst=3) хэрэгтэй. Тэр одоо ready дараалалд хүлээгээд байна.",
      },
      {
        cmd: "proc new beta 2",
        say: "beta процесс ч ирлээ - ажлын урт нь 2 цаг. Дарааллын ард нэмэгдлээ (FIFO).",
      },
      {
        cmd: "sched policy rr 2",
        say: "Бодлогыг Round Robin болгож, квантыг 2 болгов. Энэ нь: хүн бүр дараалан 2 цаг л ажиллана, дуусаагүй бол ээлжний сүүлдээ буцна.",
      },
      {
        cmd: "sched tick",
        say: "1-р цагийн алхам: alpha 2 цаг ажиллаад квант нь дүүрлээ. Ажлаа дуусгаагүй тул 'preempted' болж ready дарааллын сүүлд буцна.",
      },
      {
        cmd: "sched tick",
        say: "2-р алхам: beta CPU аваад 2 цаг ажиллана. Ажлын урт нь 2 байсан тул одоо дуусна.",
      },
      {
        cmd: "sched tick",
        say: "3-р алхам: дахин alpha-ийн ээлж. Үлдсэн 1 цагийг ажиллаад дуусгана.",
      },
      {
        cmd: "sched print",
        say: "Эцсийн байдал: хоёр процесс чинээлэг ээлжлэн ажиллаж дууслаа. Бодит кернел (task_struct, CFS) ийм л зарчмыг илүү нарийн хэрэгжүүлдэг.",
      },
    ],
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
