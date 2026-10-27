"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Gamepad2, Info, Sparkles } from "lucide-react";
import { STRUCTURE_ORDER, STRUCTURE_SPECS } from "@/lib/config";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/play", label: "Тоглох", desc: "Чөлөөт горим - командаа бичиж шууд ажиллуулах", icon: Gamepad2 },
  { href: "/about", label: "Тухай", desc: "Баг, төслийн тухай", icon: Info },
];

const ACCENT_DOT: Record<string, string> = {
  teal: "bg-teal-500",
  emerald: "bg-emerald-500",
  cyan: "bg-cyan-500",
  lime: "bg-lime-500",
  "teal-dark": "bg-teal-700",
  "emerald-dark": "bg-emerald-700",
  "cyan-dark": "bg-cyan-700",
};

/**
 * Home page: a hero that pitches the guided path, then the 7 structures as
 * colorful tiles (each links straight into free play for that structure).
 */
export function Menu() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="anim-fade-up flex flex-col items-center gap-4 py-10 text-center">
        <span className="rounded-full border border-primary/30 bg-card px-3 py-1 text-xs font-medium text-primary shadow-sm">
          F.CSM302 БД1 · Хуваарилалт 4 · Г.Ганбат
        </span>
        <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-primary md:text-5xl">
          Кернелийн 7 өгөгдлийн бүтцийг{" "}
          <span className="underline decoration-primary/40 decoration-4 underline-offset-4">
            гараараа ажилуулж
          </span>{" "}
          суръя
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Жинхэнэ C код (<code className="rounded bg-muted px-1">kds.c</code>) дээр нэг алхам тутамд тайлбартайгаар
          ажиллаж, бүтэц бүр толгойд чинь унах болно. Багш алхам бүрд гар хүргэж заана.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/learn?level=list"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5 hover:shadow-lg"
          >
            <BookOpen className="size-4" /> Хичээл эхлүүлэх
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/play"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold shadow-sm transition-transform hover:-translate-y-0.5 hover:border-primary"
          >
            <Gamepad2 className="size-4" /> Чөлөөт горим
          </Link>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          7 шат · алхам бүрд жинхэнэ кернел команд · шат бүрт шалгалт
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[240px_1fr]">
        <aside className="anim-fade-up flex flex-col gap-2">
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
        </aside>

        <main>
          <h2 className="mb-1 text-lg font-semibold">7 бүтэц, кернелийн зарчим бүрээр</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Картад дарахад тухайн бүтцийн чөлөөт горим нээгдэнэ - сурсан зүйлсээ шууд туршиж үзээрэй.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {STRUCTURE_ORDER.map((id, i) => {
              const s = STRUCTURE_SPECS[id];
              return (
                <Link
                  key={id}
                  href={`/play?structure=${id}`}
                  className="anim-fade-up group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-1 hover:border-primary hover:shadow-lg"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-10 items-center justify-center rounded-full text-xl shadow-sm",
                        ACCENT_DOT[s.accent] ?? "bg-primary",
                      )}
                    >
                      {s.emoji}
                    </span>
                    <div>
                      <span className="block font-semibold group-hover:text-primary">{s.title}</span>
                      <span className="block text-xs text-muted-foreground">{s.subtitle}</span>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{s.blurb}</p>
                  <span className="truncate text-[11px] text-muted-foreground/70">{s.kernelRef}</span>
                </Link>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
