import { BackToMenu } from "@/components/back-to-menu";
import { LevelsList } from "@/components/levels-list";
import { Tutorial } from "@/components/tutorial";
import { levelById, LEVELS } from "@/lib/levels";

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const { level: levelId } = await searchParams;
  const level = levelId ? levelById(levelId) : undefined;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <BackToMenu />
      <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
        <aside>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
            {LEVELS.length} шат
          </h2>
          <LevelsList activeId={level?.id} />
        </aside>
        <main>
          {level ? (
            <Tutorial level={level} />
          ) : (
            <div>
              <h1 className="text-2xl font-bold text-primary">Хичээл</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Эхний шатаар жагсаалтаас эхэлж, эгнээ, стек, bitmap, хэш, мод, хуваарилагч хүртэл
                нэг нэгээр нь жинхэнэ C код ажиллуулж үзнэ. Зүүн талаас шат сонгоно уу.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
