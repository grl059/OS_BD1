import { BackToMenu } from "@/components/back-to-menu";

const TEAM = [
  { name: "Н.Ням-Од", id: "B222270805" },
  { name: "А.Гэрэл", id: "B241940001" },
  { name: "А.Номин", id: "B242270088" },
  { name: "Э.Мягмаршагай", id: "B241910001" },
  { name: "О.Хүслэн", id: "B241910020" },
  { name: "Ч.Түмэншагай", id: "B160910830" },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <BackToMenu />
      <h1 className="mt-4 text-2xl font-bold text-primary">Төслийн тухай</h1>

      <section className="mt-6 space-y-2 text-sm leading-relaxed">
        <p>
          F.CSM302 "Үйлдлийн систем" хичээлийн БД1 бие даалт, Хуваарилалтын код 4: "Kernel Data
          Structures" (Operating System Concepts, 3-р бүлэг "Processes"). C хэлээр бичигдсэн
          <code className="mx-1 rounded bg-muted px-1">kds.c</code> нь Линукс кернелийн
          <code className="mx-1 rounded bg-muted px-1">struct list_head</code>, bitmap, hash,
          AVL мод, PCB/scheduler зэрэг 7 бүтцийг хуулбарладаг. Энэ вэб апп нь зөвхөн дэлгэц -
          бүх тооцоолол, төлөв C программ дотор явагддаг (<code className="mx-1 rounded bg-muted px-1">
            kds --json
          </code>
          горим, дэлгэрэнгүйг{" "}
          <a href="https://github.com/grl059/OS_BD1" className="text-primary underline">
            docs/
          </a>{" "}
          дотроос).
        </p>
        <p className="text-muted-foreground">
          Удирдагч багш: Г.Ганбат (F.CS10)
        </p>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Баг</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2 font-medium">Нэр</th>
                <th className="p-2 font-medium">Оюутны код</th>
              </tr>
            </thead>
            <tbody>
              {TEAM.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="p-2">{m.name}</td>
                  <td className="p-2 text-muted-foreground">{m.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
