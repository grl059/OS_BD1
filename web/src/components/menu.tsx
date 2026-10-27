"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { STRUCTURE_ORDER, STRUCTURE_SPECS } from "@/lib/config";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/learn", label: "Хичээл" },
  { href: "/play", label: "Чөлөөт горим" },
  { href: "/about", label: "Тухай" },
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
 * Home page: a slim top nav, a short hero with the single main call to
 * action, then the 7 structures as colorful tiles (each links straight
 * into free play for that structure).
 */
export function Menu() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <nav className="flex items-center justify-between">
        <span className="text-sm font-bold text-primary">Kernel Data Structures</span>
        <div className="flex items-center gap-5 text-sm font-medium">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className="text-muted-foreground transition-colors hover:text-primary">
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <header className="anim-fade-up flex flex-col items-center gap-4 py-10 text-center">
        <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl">
          Кернелийн <span className="text-primary">7 бүтэц</span>
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Багш нэг алхам тутамд тайлбарлана. Чи команд ажиллуулж, бүтэц өөрөө хэрхэн өөрчлөгдөж байгааг шууд харна.
        </p>
        <Link
          href="/learn?level=list"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5 hover:shadow-lg"
        >
          <BookOpen className="size-4" /> Хичээл эхлүүлэх
          <ArrowRight className="size-4" />
        </Link>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          7 шат · алхам бүрд жинхэнэ кернел команд · шат бүрт шалгалт
        </p>
      </header>

      <main>
        <h2 className="mb-1 text-lg font-semibold">7 бүтэц, кернелийн зарчим бүрээр</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Картад дарахад тухайн бүтцийн чөлөөт горим нээгдэнэ - сурсан зүйлсээ шууд туршиж үзээрэй.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
  );
}
