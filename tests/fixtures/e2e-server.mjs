// Starts a Next.js server for the Playwright acceptance tests: `node e2e-server.mjs <dev|production> <port>`.
// - `production` runs `next build`, then `next start`; `dev` runs `next dev`. Both listen on 127.0.0.1 only.
// - A fresh temporary SQLite database, removed on exit.
// - tests/fixtures/e2e-bin first on PATH, so the app's unmodified ClaudeSubscriptionReasoner starts the fake
//   `claude` CLI there. The server refuses to start unless `claude` resolves to that fake.
import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");
const fakeBin = join(here, "e2e-bin");
const [mode, port] = process.argv.slice(2);
if ((mode !== "dev" && mode !== "production") || !port) {
  console.error("usage: node tests/fixtures/e2e-server.mjs <dev|production> <port>");
  process.exit(1);
}

// Windows resolves `claude` to claude.exe or claude.com, never to this extensionless fake, so the check
// below cannot protect the subscription there.
if (process.platform === "win32") {
  console.error("e2e-server: the acceptance tests use a POSIX fake claude CLI and do not run on Windows");
  process.exit(1);
}

const PATH = [fakeBin, ...(process.env.PATH ?? "").split(delimiter).filter(Boolean)].join(delimiter);

function resolveOnPath(name, pathValue) {
  for (const dir of pathValue.split(delimiter)) {
    const candidate = join(dir, name);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // not here
    }
  }
  return null;
}

const resolved = resolveOnPath("claude", PATH);
if (resolved !== join(fakeBin, "claude")) {
  console.error(`e2e-server: claude resolves to ${resolved ?? "nothing"}, not the fake CLI; refusing to start`);
  process.exit(1);
}

const nextBin = join(repo, "node_modules", "next", "dist", "bin", "next");
const dataDir = mkdtempSync(join(tmpdir(), "pcf-e2e-"));
let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  rmSync(dataDir, { recursive: true, force: true });
};
process.on("exit", cleanup);

const env = { ...process.env, PATH, PCF_DB_PATH: join(dataDir, "pcf-e2e.db"), PCF_E2E_FAKE_CLAUDE: "1" };

if (mode === "production") {
  const build = spawnSync(process.execPath, [nextBin, "build"], { cwd: repo, env, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const server = spawn(process.execPath, [nextBin, mode === "dev" ? "dev" : "start", "-H", "127.0.0.1", "-p", port], {
  cwd: repo,
  env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code, signal) => {
  cleanup();
  process.exit(code ?? (signal ? 1 : 0));
});
