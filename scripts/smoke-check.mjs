#!/usr/bin/env node
import { spawn } from "node:child_process";

const host = "127.0.0.1";
const port = String(process.env.SMOKE_PORT || 3131);
const baseUrl = `http://${host}:${port}`;
const startupTimeoutMs = 10000;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < startupTimeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/status`);
      if (res.ok) {
        return;
      }
    } catch {
      // Retry until the server is listening.
    }
    await wait(200);
  }

  throw new Error(`Server did not become ready within ${startupTimeoutMs}ms.`);
}

async function expectJson(path, label) {
  const res = await fetch(`${baseUrl}${path}`);
  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    throw new Error(`${label} returned HTTP ${res.status}.`);
  }

  if (!contentType.includes("application/json")) {
    throw new Error(`${label} did not return JSON.`);
  }

  return res.json();
}

async function expectHtml(path, label) {
  const res = await fetch(`${baseUrl}${path}`);
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`${label} returned HTTP ${res.status}.`);
  }

  if (!text.includes("GPT Image 2 ローカル画像生成")) {
    throw new Error(`${label} did not include the app title.`);
  }
}

const server = spawn(process.execPath, ["server.js"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    HOST: host,
    PORT: port
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let serverOutput = "";
server.stdout.on("data", chunk => {
  serverOutput += chunk;
});
server.stderr.on("data", chunk => {
  serverOutput += chunk;
});

try {
  await waitForServer();

  await expectHtml("/", "GET /");
  const status = await expectJson("/api/status", "GET /api/status");
  const outputs = await expectJson("/api/outputs", "GET /api/outputs");
  const logs = await expectJson("/api/logs", "GET /api/logs");

  if (status.ok !== true) {
    throw new Error("GET /api/status did not report ok: true.");
  }
  if (!Array.isArray(outputs.files)) {
    throw new Error("GET /api/outputs did not return files array.");
  }
  if (!Array.isArray(logs.logs)) {
    throw new Error("GET /api/logs did not return logs array.");
  }

  console.log(`Smoke check passed at ${baseUrl}`);
} catch (err) {
  console.error(err.message);
  if (serverOutput.trim()) {
    console.error(serverOutput.trim());
  }
  process.exitCode = 1;
} finally {
  server.kill();
}
