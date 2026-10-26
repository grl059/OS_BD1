import { BackToMenu } from "@/components/back-to-menu";
import { LevelsList } from "@/components/levels-list";

export default function LevelsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <BackToMenu />
      <h1 className="mt-4 mb-1 text-2xl font-bold text-primary">Бүх шат</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Бүтэц бүрийг дарааллаар үзэх бол доороос сонгоно уу - эсвэл шууд{" "}
        <a href="/play" className="text-primary underline">
          чөлөөт горимд
        </a>{" "}
        орж болно.
      </p>
      <LevelsList base="/learn" />
    </div>
  );
}
