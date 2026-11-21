# Kernel module: жинхэнэ Linux дээрх нотолгоо

> **Төлөв: хийгдсэн.** Сүүлийн ажиллуулалт **2026-11-19 04:05:12 (UTC+8)** — Ubuntu 24.04.2 LTS,
> kernel 6.11.0-17-generic, gcc 13.3.0, host `b241940001-server`, **Secure Boot идэвхтэй**, MOK
> гарын үсэгтэй. `sh src/kernel/run_module_test.sh` → **9 PASS**.
> Үүний өмнө 2026-11-18-нд анхны амжилттай ачаалал хийгдсэн; репод хадгалсан log файл нь дээрх
> 2026-11-19-ний давтан ажиллуулалтын гаралт юм (`kernel_build_log.txt`-ийн `# date:` мөр).
> Дэлгэцийн зураг: Report-ын **Зураг 6.2, 6.3, 6.4**. Түүхий гаралт: `docs/kernel_build_log.txt`,
> `docs/kernel_dmesg.txt`.

## 1. Ямар кодыг ажиллуулсан бэ

| Зүйл | Утга |
|---|---|
| `src/kernel/kds_module.c` | commit `786ec65` (2026-10-27) — тэр үеэс өөрчлөгдөөгүй байхад log авсан |
| Гарын үсэг | `~/mok/MOK.priv` + `MOK.der`, `scripts/sign-file sha256` → `modinfo`-д `signer: kds module signing` |
| Ачаалал | `insmod kds_module.ko` (анхдагч `start=25`), `start=15`, `start=0` (татгалзал) |

Эдгээр параметрт модулийн гаргах `pr_info` мөрүүд тоо, үгээрээ өөрчлөгдөөгүй тул 2026-11-19-ний log
одоогийн хувилбарыг төлөөлнө. Өөр kernel дээр дахин build + ажиллуулж шинэ log авах хэрэгтэй.

## 2. 9 PASS-ийн задалгаа

| # | Мөр | Шалгадаг зүйл |
|---|---|---|
| 1 | `PASS build` | `make` → `kds_module.ko` үүссэн, `make exit=0`, compiler warning алга |
| 2 | `PASS sign (~/mok)` | MOK-оор гарын үсэг зурсан (**Secure Boot идэвхгүй үед энэ мөр гарахгүй → 8 PASS**) |
| 3 | `PASS /proc/kds ()` | `start=25` ачаалалын дараа `/proc/kds`-д `start=`, `hashtable(`, `rbtree(` байсан |
| 4 | `PASS insmod  (ok)` | `insmod kds_module.ko` амжилттай, `lsmod`-д харагдсан, `rmmod`-ийн дараа unload log гарсан |
| 5 | `PASS /proc/kds (start=15)` | дээрхтэй адил, `start=15` ачаалалд |
| 6 | `PASS insmod start=15 (ok)` | `insmod kds_module.ko start=15` амжилттай |
| 7 | `PASS insmod start=0 (fail)` | `insmod: Invalid parameters` + `start must be 1..1000000 (got 0)` — татгалагдах ёстой |
| 8 | `PASS collatz start=25: 24 terms` | dmesg-ийн `kds: collatz <n>` мөрийг тоолоход 24 |
| 9 | `PASS collatz start=15: 18 terms` | адил, 18 |

## 3. `kernel_dmesg.txt` файлын бүтэц

Ажиллуулалт бүрт дараах хэсгүүд тус тусад нь бичигдэнэ:

```
### insmod kds_module.ko <параметр>   → insmod-ын stderr, (lsmod: ...), ### cat /proc/kds (бүтэн агуулга)
### dmesg: load                       → ачаалах үеийн kds: мөрүүд (color, collatz, birthday, fifo, bitmap, hash, rb, /proc/kds created)
### rmmod kds_module                  → rmmod командыйн алдаа (байвал)
### dmesg: unload                     → цэвэрлэлтийн kds: removing ... + module unloaded
### dmesg: rejected load              → зөвхөн start=0: loading module (start=0) + start must be 1..1000000 (got 0)
```

**Тэмдэглэл:** репод буй `docs/kernel_dmesg.txt` (2026-11-19) нь `### dmesg: load` / `### dmesg: unload`
гарчгуудыг тусгайлан бичихээс өмнөх скриптийн хувилбараар үүссэн — ачаалах болон unload мөрүүд
`### rmmod kds_module` гарчгийн доор нэгтгэгдсэн. `kds:` агуулгын мөрүүд ижил, зөвхөн хэсгийн нэр
өөр. Одоогийн скриптээр дахин ажиллуулбал дээрх таван гарчиг ялгагдаж бичигдэнэ.

## 4. Давтах заавар

```sh
sudo apt update
sudo apt install build-essential linux-headers-$(uname -r)
mokutil --sb-state        # "SecureBoot enabled" бол Manual 2.7-ийн MOK алхмыг эхлээд хийнэ
git pull origin main
sh src/kernel/run_module_test.sh     # root эрх шаардлагатай
```

Скрипт ажиллах машиндаа өөрчлөлт оруулна: ачаалал бүрийн өмнө `sudo dmesg -C`-ээр kernel-ийн
бичлэгийн буферыг цэвэрлэнэ (хадгалахыг хүссэн лог байвал урьдчилан хуулна), мөн өмнө нь
ачаалагдсан `kds_module`-ийг мэдэгдэлгүйгээр `rmmod` хийнэ. Өөрийн VM дээр ажиллуул.

Гаралт:

- `docs/kernel_build_log.txt` — орчны толгой мөр (date/host/kernel/os/gcc/secure boot) + `make` бүтэн гаралт + `modinfo`
- `docs/kernel_dmesg.txt` — гурван ачааллын `### cat /proc/kds` болон `kds:` мөрүүд

```sh
git add docs/kernel_build_log.txt docs/kernel_dmesg.txt
git commit -m "docs: kernel module-ийн <огноо>-ний нотолгооны log-ийг шинэчлэв"
```

Log-ийн огноо, PASS тоо, Report-ын зургийн дугаар (Зураг 6.2--6.4) болон Manual 2.7/2.8-ийн тоог
зөрүүлэлтгүй шинэчлэх хэрэгтэй. Нотолгоо гараагүй байхад Report/Manual-д «PASS» гэж бичихгүй.
