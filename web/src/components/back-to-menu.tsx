import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackToMenu({ label = "Нүүр цэс" }: { label?: string }) {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ChevronLeft className="size-4" />
      {label}
    </Link>
  );
}
