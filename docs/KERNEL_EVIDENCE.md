# Kernel module: жинхэнэ Linux дээрх нотолгоо

> **Төлөв: хийгдсэн (2026-11-18).** Ubuntu 24.04.2, kernel 6.11.0-17-generic, Secure Boot идэвхтэй, MOK гарын үсэгтэй; `run_module_test.sh` 9 PASS. Үр дүн Report-ын Зураг 6.2--6.4-т, түүхий гаралт нь docs/kernel_build_log.txt ба docs/kernel_dmesg.txt-д. Доорх нь давтах заавар.

Review (II-4-13, P4) нь Report-ын Зураг 7 (dmesg) **өмнөх** хувилбарынх, харин одоогийн
`src/kernel/kds_module.c` (Part I `struct color`, Part II Collatz + `start` параметр,
hashtable/rbtree/`/proc/kds`) жинхэнэ Linux дээр ачаалагдсан нотолгоогүй гэж тэмдэглэсэн.
Энэ нотолгоог **зөвхөн жинхэнэ Linux (VM эсвэл үндсэн машин; WSL/Docker биш)** дээр гаргана.
Кодыг хийсэн хүн энэ файл дахь алхмыг гүйцэтгэж, гарсан файлуудаа commit хийнэ.

## 1. Бэлтгэл (Ubuntu 24.04)

```sh
sudo apt update
sudo apt install build-essential linux-headers-$(uname -r)
mokutil --sb-state        # "SecureBoot enabled" бол Manual 2.7-ийн MOK алхмыг эхлээд хийнэ
```

## 2. Автомат скрипт

```sh
git pull origin main
sh src/kernel/run_module_test.sh
```

Скрипт дараах файлуудыг үүсгэнэ (**одоогийн** кодоор):

- `docs/kernel_build_log.txt` -- `make` дүүрэн гаралт (warning-гүй эсэх)
- `docs/kernel_dmesg.txt` -- `start=25`, `start=15`, `start=0` гурван ачаалалтын dmesg

## 3. Шалгах зүйл (хүлээгдэх үр дүн)

| Тохиолдол | Хүлээгдэх |
|---|---|
| `insmod kds_module.ko` (start=25) | 4 `color` мөр, `collatz start=25 terms=24` |
| `insmod kds_module.ko start=15` | `collatz start=15 terms=18` |
| `insmod kds_module.ko start=0` | `start must be 1..1000000 (got 0)`, `insmod: Invalid parameters` |
| `rmmod kds_module` | `removing color/collatz/birthday`, `module unloaded` |
| `cat /proc/kds` | `start=`, `colors:`, `collatz(terms=..)`, `birthdays:`, `hashtable(buckets=.., entries=..)` хэсгүүд |

## 4. Commit ба Report-д оруулах

```sh
git add docs/kernel_build_log.txt docs/kernel_dmesg.txt
git commit -m "Kernel module: одоогийн хувилбарын insmod/rmmod нотолгоо (Ubuntu <хувилбар>, kernel <uname -r>)"
```

Дараа нь `dmesg`-ийн дэлгэцийн зургийг `docs/report_src/img/`-д хуулж, `docs/latex/report.tex`-ийн
8-р хэсгийн «Зураг 7»-ын оронд (эсвэл дараа нь «Зураг 8» болгон) оруулаад Report-ын
«Kernel module, одоогийн хувилбар» мөрийг «PASS» болгож, 9-р хэсгийн Хязгаарлалт 1-ийг шинэчилнэ.
Manual 2.8-ийн «`run_module_test.sh`: 3 PASS» мөр тэр үед жинхэнэ нотолгоотой болно.
Нотолгоо гараагүй байхад Report/Manual-д «PASS» гэж бичихгүй.
