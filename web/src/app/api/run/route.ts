import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export const runtime = "nodejs";

// Built by the top-level `make` (see ../README.md) from src/user/kds.c.
// process.cwd() is the web/ app's own root while this route runs, so the
// core binary - one level up, where the Makefile puts it - is "../kds"
// ("../kds.exe" on native Windows, where gcc/mingw names it that way).
const KDS_BIN = path.join(process.cwd(), "..", process.platform === "win32" ? "kds.exe" : "kds");

const MAX_SCRIPT_BYTES = 64 * 1024; // generous; a few hundred lines is the realistic max
const MAX_SCRIPT_LINES = 2000;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "body must be JSON" }), { status: 400 });
  }

  const script = (body as { script?: unknown } | null)?.script;
  if (typeof script !== "string") {
    return new Response(JSON.stringify({ error: '"script" must be a string' }), { status: 400 });
  }
  if (Buffer.byteLength(script, "utf8") > MAX_SCRIPT_BYTES) {
    return new Response(JSON.stringify({ error: "script too large" }), { status: 413 });
  }
  if (script.split("\n").length > MAX_SCRIPT_LINES) {
    return new Response(JSON.stringify({ error: "too many lines" }), { status: 413 });
  }

  if (!fs.existsSync(KDS_BIN)) {
    return new Response(
      JSON.stringify({
        error: "C core not built. Run `make` at the project root to build ./kds first.",
      }),
      { status: 503 },
    );
  }

  const child = spawn(KDS_BIN, ["--json"], { stdio: ["pipe", "pipe", "pipe"] });
  child.stdin.write(script);
  child.stdin.end();

  let stderrBuf = "";
  child.stderr.on("data", (c: Buffer) => {
    stderrBuf += c.toString("utf8");
  });

  const onAbort = () => {
    if (!child.killed) child.kill("SIGTERM");
  };
  req.signal.addEventListener("abort", onAbort);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      child.stdout.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      child.on("close", (code) => {
        req.signal.removeEventListener("abort", onAbort);
        if (code !== 0 && code !== null) {
          // A non-zero exit means the core itself faulted (e.g. a sanitizer
          // report) rather than reporting an ERR line - surface it as a
          // trailing ndjson line the client can show, instead of silently
          // truncating the stream.
          const line = JSON.stringify({
            type: "end",
            steps: -1,
            fatal: `kds exited ${code}${stderrBuf ? `: ${stderrBuf.trim()}` : ""}`,
          });
          controller.enqueue(new TextEncoder().encode(line + "\n"));
        }
        controller.close();
      });
      child.on("error", (err) => {
        controller.error(err);
      });
    },
    cancel() {
      onAbort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
