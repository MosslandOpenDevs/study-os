#!/usr/bin/env node
/**
 * Runtime smoke test for the built API artifact.
 *
 * Boots the real Node process from apps/api/dist/server.js, verifies the
 * health endpoints and the cross-package demo route respond, then sends
 * SIGTERM and asserts a clean (exit code 0) graceful shutdown.
 *
 * This exists because the original scaffold compiled fine but crashed at
 * runtime with ERR_MODULE_NOT_FOUND — "pnpm build passes" must never again be
 * mistaken for "the API runs".
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = Number.parseInt(process.env.SMOKE_PORT ?? "31547", 10);
const BASE = `http://127.0.0.1:${PORT}`;
const ENTRY = "apps/api/dist/server.js";

function fail(message) {
  console.error(`SMOKE FAIL: ${message}`);
  process.exitCode = 1;
}

const child = spawn(process.execPath, [ENTRY], {
  env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1" },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk;
});
child.stderr.on("data", (chunk) => {
  output += chunk;
});

const exited = new Promise((resolve) => {
  child.on("exit", (code, signal) => resolve({ code, signal }));
});
let exitedEarly = false;
void exited.then(() => {
  exitedEarly = true;
});

async function waitForHealthz() {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (exitedEarly) {
      return false;
    }
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.ok) {
        return true;
      }
    } catch {
      // Server not accepting connections yet.
    }
    await sleep(250);
  }
  return false;
}

async function main() {
  if (!(await waitForHealthz())) {
    fail(`server did not answer /healthz on port ${PORT} within 10s`);
    return;
  }
  console.log("smoke: /healthz OK");

  const ready = await fetch(`${BASE}/readyz`);
  const readyBody = await ready.json();
  if (!ready.ok || readyBody.status !== "ready") {
    fail(`/readyz unexpected: ${ready.status} ${JSON.stringify(readyBody)}`);
    return;
  }
  if (process.env.DATABASE_URL && readyBody.database !== "ok") {
    fail(`/readyz did not verify database connectivity: ${JSON.stringify(readyBody)}`);
    return;
  }
  console.log("smoke: /readyz OK");

  const demo = await fetch(`${BASE}/api/demo/study-loop`);
  const demoBody = await demo.json();
  if (
    !demo.ok ||
    !Array.isArray(demoBody.ingestion?.units) ||
    demoBody.ingestion.units.length === 0 ||
    !Array.isArray(demoBody.quizDraft) ||
    demoBody.quizDraft.length === 0 ||
    typeof demoBody.reviewTask?.scheduledAt !== "string"
  ) {
    fail(`/api/demo/study-loop unexpected: ${demo.status} ${JSON.stringify(demoBody)}`);
    return;
  }
  console.log("smoke: /api/demo/study-loop OK (ingestion + quiz-engine + scheduler resolved)");

  // With a database available (CI: migrated + seeded), exercise the real
  // upload contract end to end against the booted artifact.
  if (process.env.DATABASE_URL) {
    const created = await fetch(`${BASE}/api/sources`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "seed-user",
        title: "스모크 업로드",
        sourceType: "text",
        rawText: "첫 문단입니다.\n\n둘째 문단입니다.",
      }),
    });
    const createdBody = await created.json();
    if (created.status !== 201 || createdBody.unitCount !== 2) {
      fail(`POST /api/sources unexpected: ${created.status} ${JSON.stringify(createdBody)}`);
      return;
    }
    const fetched = await fetch(`${BASE}/api/sources/${createdBody.sourceId}`);
    const fetchedBody = await fetched.json();
    if (!fetched.ok || fetchedBody.units?.length !== 2) {
      fail(`GET /api/sources/:id unexpected: ${fetched.status} ${JSON.stringify(fetchedBody)}`);
      return;
    }
    console.log("smoke: /api/sources upload + fetch round-trip OK (persisted to Postgres)");
  }

  child.kill("SIGTERM");
  const result = await Promise.race([exited, sleep(5000).then(() => null)]);
  if (result === null) {
    fail("server did not exit within 5s of SIGTERM");
    return;
  }
  if (result.code !== 0) {
    fail(`server exited with code ${result.code} (signal ${result.signal ?? "none"})`);
    return;
  }
  console.log("smoke: graceful shutdown OK (exit code 0)");
  console.log("SMOKE PASS");
}

try {
  await main();
} finally {
  if (!exitedEarly) {
    child.kill("SIGKILL");
  }
  if (process.exitCode === 1) {
    console.error("--- server output ---");
    console.error(output);
  }
}
