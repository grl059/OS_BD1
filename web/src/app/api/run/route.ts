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
// JSON escaping can only grow the body, so a request far above the script
// limit is refused from the Content-Length header, before the body is read.
const MAX_BODY_BYTES = 4 * MAX_SCRIPT_BYTES;
const RUN_TIMEOUT_MS = 10_000;
const KILL_GRACE_MS = 2_000;

/** `error` is the technical string, `userMessage` what /play shows. */
function refuse(status: number, error: string, userMessage: string): Response {
  return new Response(JSON.stringify({ error, userMessage }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return refuse(413, "request body too large",
      "Командын жагсаалт хэт их байна. Хуудсыг «Шинээр эхлэх»-ээр цэвэрлээд богино жагсаалтаар оролдоно уу.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return refuse(400, "body must be JSON",
      "Дэлгэцээс илгээсэн хүсэлт буруу хэлбэртэй байна. Хуудсаа сэргээгээд дахин оролдоно уу.");
  }

  const script = (body as { script?: unknown } | null)?.script;
  if (typeof script !== "string") {
    return refuse(400, '"script" must be a string',
      "Дэлгэцээс илгээсэн хүсэлт буруу хэлбэртэй байна. Хуудсаа сэргээгээд дахин оролдоно уу.");
  }
  if (Buffer.byteLength(script, "utf8") > MAX_SCRIPT_BYTES) {
    return refuse(413, "script too large",
      `Командын жагсаалт хэт урт байна (хамгийн ихдээ ${MAX_SCRIPT_BYTES / 1024} КБ). «Шинээр эхлэх» дарж богино жагсаалтаар оролдоно уу.`);
  }
  if (script.split("\n").length > MAX_SCRIPT_LINES) {
    return refuse(413, "too many lines",
      `Командын жагсаалт хэт урт байна (хамгийн ихдээ ${MAX_SCRIPT_LINES} мөр). «Шинээр эхлэх» дарж богино жагсаалтаар оролдоно уу.`);
  }

  if (!fs.existsSync(KDS_BIN)) {
    return refuse(503, "C core not built",
      "C цөм байхгүй байна. Төслийн үндсэн лавлахад `make` гэж ажиллуулж ./kds-г build хийнэ.");
  }

  const child = spawn(KDS_BIN, ["--json"], { stdio: ["pipe", "pipe", "pipe"] });
  // kds can exit before the whole script is written (a faulting line); without
  // a listener that EPIPE becomes an unhandled 'error' event and kills the
  // dev server. The close handler below reports the real cause.
  child.stdin.on("error", () => {});
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

  // A hung core must not hold the request (and its stdout pipe) open forever.
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }, KILL_GRACE_MS);
  }, RUN_TIMEOUT_MS);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      child.stdout.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        req.signal.removeEventListener("abort", onAbort);
        if (code !== 0 || timedOut) {
          // A non-zero exit means the core itself faulted (e.g. a sanitizer
          // report) rather than reporting an ERR line - surface it as a
          // trailing ndjson line the client can show, instead of silently
          // truncating the stream.
          const why = timedOut ? `kds timed out after ${RUN_TIMEOUT_MS} ms` : `kds exited ${code}`;
          const line = JSON.stringify({
            type: "end",
            steps: -1,
            fatal: `${why}${stderrBuf ? `: ${stderrBuf.trim()}` : ""}`,
          });
          controller.enqueue(new TextEncoder().encode(line + "\n"));
        }
        controller.close();
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        controller.error(err);
      });
    },
    cancel() {
      clearTimeout(timer);
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
