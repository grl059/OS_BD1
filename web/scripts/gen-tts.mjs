#!/usr/bin/env node
/**
 * Generates the tutor's spoken explanation for every guided step into
 * public/tts/<levelId>-<stepIndex>.mp3 using a Mongolian neural voice
 * (edge-tts, mn-MN-YesuiNeural). Re-run after editing `say` lines in
 * src/lib/levels.ts:
 *
 *   python3 -m pip install --user edge-tts   # once
 *   node scripts/gen-tts.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VOICE = process.env.TTS_VOICE ?? "mn-MN-YesuiNeural";
const EDGE_TTS =
  process.env.EDGE_TTS ?? `${process.env.HOME}/Library/Python/3.9/bin/edge-tts`;

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "tts");
mkdirSync(outDir, { recursive: true });

const { LEVELS } = await import(join(here, "..", "src", "lib", "levels.ts"));

/**
 * The on-screen text is written for readers; the spoken version drops
 * notation a Mongolian voice misreads (O(1), hfun(), snake_case).
 */
function speakable(text) {
  return text
    .replace(/O\(log n\)/g, "О лог эн")
    .replace(/O\(n\)/g, "О эн")
    .replace(/O\(1\)/g, "О нэг")
    .replace(/hfun\(\)/g, "хэш функц")
    .replace(/struct list_head/g, "лист хед бүтэц")
    .replace(/list_head/g, "лист хед")
    .replace(/include\/linux\/bitmap\.h/g, "битмап хэрэгслийн толгой файл")
    .replace(/task_struct/g, "таск структ")
    .replace(/(\w+)_(\w+)/g, "$1 $2")
    .replace(/\(\)/g, "")
    .replace(/"/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

let made = 0;
for (const level of LEVELS) {
  for (let i = 0; i < level.steps.length; i++) {
    const target = join(outDir, `${level.id}-${i}.mp3`);
    execFileSync(EDGE_TTS, ["--voice", VOICE, "--text", speakable(level.steps[i].say), "--write-media", target], {
      stdio: ["ignore", "ignore", "inherit"],
    });
    made++;
    console.log(`✓ ${level.id}-${i}`);
  }
}
console.log(`${made} MP3 үүсгэв → ${outDir}`);
