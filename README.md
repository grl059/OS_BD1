# Kernel Data Structures

**F.CSM302 Үйлдлийн систем · БД1 · Хуваарилалтын код: V-1-4**
Үзүүлэлт: **Kernel structure graph** · Бүлэг: **3 – Processes** · Сурах бичиг: Silberschatz, Galvin, Gagne, *Operating System Concepts* (Programming Project «Kernel Data Structures», онол нь 1.9-д)

## Зорилго
Linux kernel-ийн өгөгдлийн бүтцүүдийг хэрэгжүүлж, элемент **нэмэх, устгах, хайх** үйлдлийн дараах бүтцийг графаар харуулна:

| Бүтэц | Хэрэгжилт | Нэмэх / устгах / хайх |
|---|---|---|
| Холбоост жагсаалт | `list_head` (struct birthday), давхар холбоост дугуй | `add_head`, `add_tail` / `del` / `find` |
| Queue (FIFO), Stack (LIFO) | `list_head` дээр | `push` / `pop` / `find` |
| Bitmap | 1..128 бит | `set` / `clear` / `test` |
| Hash map | хэш = тэмдэгтийн кодын нийлбэр mod n, collision-д bucket доторх `list_head` жагсаалт | `put` / `del` / `get` |
| Binary search tree | энгийн BST ба тэнцвэржсэн AVL (`tree mode avl`) | `insert` / `delete` / `find` |
| Процесс ба scheduler | PCB + `list_head` ready queue, FCFS ба Round Robin | `proc new` / дуусах / `sched print` |
| Kernel module | `struct color` жагсаалт, `start` параметртэй Collatz жагсаалт, birthday, kfifo, bitmap | `insmod` / `rmmod` |

## Quick Start (Linux / macOS / WSL; gcc, make)
```sh
git clone https://github.com/grl059/OS_BD1.git kernel-data-structures
cd kernel-data-structures
make                        # src/user/kds.c -> ./kds (ASan + UBSan)
make test                   # 6 жишээ + stress: бүгд PASS
./kds examples/textbook.txt
```
**macOS 26 + Apple clang:** the bundled ASan runtime can hang while initializing
(no output, 100% CPU). Build without sanitizers instead: `make SAN=0`; the tests
and the web app work the same, only the sanitizer checks are skipped.
**Веб интерфэйс** (Next.js; `../kds`-г шууд ажиллуулдаг, өөрөө дахин хэрэгжүүлдэггүй - `web/EVENT_FORMAT.md`):
```sh
make                        # эхлээд C цөмийг ./kds болгож build хийнэ
cd web
npm install                 # (эхний удаа)
npm run dev                 # http://localhost:3000
```
Цэс → Тоглох / Хичээл / Тухай. `/play` хуудас нь өөрийн бичсэн командыг `/api/run`-р дамжуулж, `kds --json`-ийн буцаасан JSON урсгалаас дэлгэцийг шууд дүүргэнэ - дэлгэц дээр харагдах бүх зүйл (жагсаалт, мод, scheduler progress bar гэх мэт) C программын state-ээс гаралтай.

**Нэмэлт тест** (node ≥ 18, python3 хэрэгтэй):
```sh
make check                  # make test + --json==текст (json_check.py) + fuzz (8 seed x 5000 команд) + AVL шалгалт
cd web && npm test           # lib/model.ts, lib/levels.ts - сүүлийнх нь ./kds-г жинхэнээр ажиллуулж шалгадаг
```

**Kernel module** (жинхэнэ Linux + `linux-headers-$(uname -r)`):
```sh
sh src/kernel/run_module_test.sh     # build, insmod (start=25, start=15, start=0), rmmod
                                     # -> docs/kernel_build_log.txt, docs/kernel_dmesg.txt
```

## Командууд
```
list   add_head|add_tail|del|find <өдөр> <сар> <жил>  ·  list print|clear
queue  push|find <int>  ·  queue pop|print            (stack мөн адил, багтаамж 8)
bitmap size <1..128>  ·  bitmap set|clear|test <i>  ·  bitmap print
hash   size <1..16>  ·  hash put <key> <value>  ·  hash get|del <key>  ·  hash print|clear
tree   mode bst|avl  ·  tree insert|delete|find <int>  ·  tree print
proc   new <нэр> <ажил 1..20>
sched  policy fcfs|rr <квант 1..10>  ·  sched tick|print|clear
```
`#`-ээс хойших хэсэг коммент. Буруу оролт бүр `ERR ...` мессеж өгнө.

## Repository бүтэц
| Зам | Агуулга |
|---|---|
| `src/user/kds.c` | User-space хэрэгжилт (list.h-ийн `list_head`, `container_of`) + командын интерпретатор + `--json` горим (вэб-д зориулсан, текст горимыг өөрчлөхгүй) |
| `src/kernel/` | Linux kernel module, Makefile, `run_module_test.sh` |
| `web/` | Next.js веб апп - `src/app` (хуудсууд, `/api/run`), `src/components`, `src/lib` (`model.ts`, `config.ts`, `levels.ts`, `use-run.ts`); `EVENT_FORMAT.md` - JSON протоколын тодорхойлолт |
| `examples/` | textbook, all_structures, errors, search, scheduler, scheduler_full |
| `tests/` | хүлээгдэх гаралт, `run_tests.sh`, `json_check.py`, `fuzz_json.py`, `avl_check.py` |
| `.github/workflows/` | `ci.yml` (C цөм + веб апп build/тест, ubuntu+macos), `release.yml` (CI амжилттай болсон тутамд conventional-commit дүрмээр хувилбар нэмэгдүүлж release гаргадаг) |
| `docs/` | `4_BD1_Report.pdf`, `4_Manual.pdf`; `report_src/img/ui_*.png` – веб UI-ийн бодит дэлгэцийн зураг |

## Known issues
- Kernel module-ийг жинхэнэ Linux дээр build хийнэ (WSL, Docker дээр ачаалагдахгүй). Secure Boot идэвхтэй бол MOK түлхүүрээр гарын үсэг зурна (Manual 2.6).
- Hash map-ийн bucket-ийн тоо тогтмол (resize байхгүй); queue, stack, процесс хамгийн ихдээ 8; hash 24 элемент.
- Scheduler-т бүх процесс `proc new` хийсэн мөчид ирнэ; I/O ба priority байхгүй.
- Веб апп нь C-г **дахин хэрэгжүүлдэггүй**: дэлгэц дээрх бүх зүйл `kds --json`-ийн гаргасан `state`-ээс шууд ирдэг (`tests/json_check.py`, `web` дотор `node --test` баталгаажуулна).

## Бэлэн код, сан, AI ашиглалт
- Гадны сан ашиглаагүй. `list_head`-ийн функцуудыг Linux `include/linux/list.h`-ийн семантикаар өөрсдөө бичсэн.
- **AI хэрэгсэл: Claude (Anthropic)** — тайлангийн ноорог, C програмыг UI-ийн хөдөлгүүртэй нийцүүлэх, тест скрипт, README/Manual засварт ашигласан. Бүх кодыг баг ажиллуулж, тестээр шалгасан.
