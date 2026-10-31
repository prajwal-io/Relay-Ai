import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("MCP process answers initialize on stdout without requiring the Relay API", async () => {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const npmCli = process.env.npm_execpath;
  assert.ok(npmCli, "Run this smoke test through npm so npm_execpath is available.");
  const child = spawn(process.execPath, [npmCli, "--silent", "--prefix", repoRoot, "run", "mcp", "--workspace", "@relay-ai/mcp"], {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, RELAY_API_URL: "http://127.0.0.1:4317/api/v1" },
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
  child.stdin.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "relay-mcp-smoke-test", version: "0.1.0" },
    },
  })}\n`);

  try {
    const deadline = Date.now() + 5_000;
    while (!stdout.includes("\n") && Date.now() < deadline) await delay(25);
    const responseLine = stdout.split("\n").find((line) => line.trim());
    assert.ok(responseLine, `Expected JSON-RPC initialize response. stderr: ${stderr}`);
    const response = JSON.parse(responseLine);
    assert.equal(response.id, 1);
    assert.equal(response.jsonrpc, "2.0");
    assert.equal(response.result?.serverInfo?.name, "relay-ai");
    assert.equal(typeof response.result?.protocolVersion, "string");

    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
    const listDeadline = Date.now() + 5_000;
    while (stdout.split("\n").filter((line) => line.trim()).length < 2 && Date.now() < listDeadline) await delay(25);
    const listLine = stdout.split("\n").filter((line) => line.trim())[1];
    assert.ok(listLine, `Expected tools/list response. stderr: ${stderr}`);
    const listed = JSON.parse(listLine);
    const tools = listed.result?.tools ?? [];
    const toolNames = tools.map((tool: { name: string }) => tool.name);
    assert.ok(toolNames.includes("relay_get_project_context"));
    assert.ok(toolNames.includes("relay_create_handoff"));
    const loadTool = tools.find((tool: { name: string }) => tool.name === "relay_load_handoff");
    assert.ok(loadTool?.inputSchema?.required?.includes("destination"), "handoff retrieval must identify its intended assistant");
  } finally {
    child.stdin.end();
    if (child.exitCode === null) child.kill();
    await Promise.race([once(child, "close"), delay(1_000)]);
  }
});
