"use client";

import Link from "next/link";
import { BookOpen, Gamepad2, Info } from "lucide-react";
import { STRUCTURE_ORDER, STRUCTURE_SPECS } from "@/lib/config";

const NAV = [
  { href: "/play", label: "Тоглох", desc: "Чөлөөт горим - командаа бичиж шууд ажиллуулах", icon: Gamepad2 },
  { href: "/learn", label: "Хичээл", desc: "7 шатлалтай заавар + шалгалт", icon: BookOpen },
  { href: "/about", label: "Тухай", desc: "Баг, төслийн тухай", icon: Info },
];

/**
 * Home page. Deliberately laid out differently from the reference project:
 * a left rail of destinations plus a right-hand grid of the 7 structures
 * (reference used a single centered column), in this project's teal/green
 * palette rather than its colors.
 */
export function Menu() {
  return (
    <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-8 px-6 py-10 md:grid-cols-[280px_1fr]">
      <aside className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Kernel Data Structures</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            F.CSM302 БД1 · Хуваарилалт 4 · Г.Ганбат
          </p>
        </div>
        <nav className="flex flex-col gap-2">
          {NAV.map(({ href, label, desc, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary hover:bg-accent"
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <span className="block font-medium group-hover:text-primary">{label}</span>
                <span className="block text-xs text-muted-foreground">{desc}</span>
              </span>
            </Link>
          ))}
        </nav>
      </aside>

      <main>
        <h2 className="mb-1 text-lg font-semibold">7 бүтэц, кернелийн зарчим бүрээр</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Доорх бүтэц бүр нь жинхэнэ C код (<code className="rounded bg-muted px-1">kds.c</code>) дээр
          ажилладаг - энэ хуудас зөвхөн C программын гаргасан төлвийг харуулдаг.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {STRUCTURE_ORDER.map((id) => {
            const s = STRUCTURE_SPECS[id];
            return (
              <Link
                key={id}
                href={`/play?structure=${id}`}
                className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
              >
                <span className="font-semibold">{s.title}</span>
                <span className="text-xs text-muted-foreground">{s.subtitle}</span>
                <span className="mt-2 truncate text-[11px] text-muted-foreground/70">{s.kernelRef}</span>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
