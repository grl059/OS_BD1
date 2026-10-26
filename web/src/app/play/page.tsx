import { Suspense } from "react";
import { BackToMenu } from "@/components/back-to-menu";
import { Simulator } from "@/components/simulator";
import { STRUCTURES, type StructureName } from "@/lib/model";

function isStructureName(v: string | undefined): v is StructureName {
  return !!v && (STRUCTURES as readonly string[]).includes(v);
}

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ structure?: string }>;
}) {
  const { structure } = await searchParams;
  const initial = isStructureName(structure) ? structure : "list";

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <BackToMenu />
      <h1 className="mt-4 mb-6 text-2xl font-bold text-primary">Чөлөөт горим</h1>
      <Suspense>
        <Simulator initialStructure={initial} />
      </Suspense>
    </div>
  );
}
