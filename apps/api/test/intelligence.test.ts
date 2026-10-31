import assert from "node:assert/strict";
import { test } from "node:test";
import { configuredExtractionProvider, extractContext } from "../src/intelligence.js";

test("Groq extraction uses strict structured output, redacts secrets, retries, and parses safely", async () => {
  const oldKey = process.env.GROQ_API_KEY;
  const oldModel = process.env.GROQ_MODEL;
  const oldFetch = globalThis.fetch;
  process.env.GROQ_API_KEY = "test-key-never-sent-to-real-network";
  process.env.GROQ_MODEL = "openai/gpt-oss-20b-test";
  let calls = 0;
  try {
    globalThis.fetch = async (input, init) => {
      calls++;
      assert.equal(String(input), "https://api.groq.com/openai/v1/chat/completions");
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-key-never-sent-to-real-network");
      const request = JSON.parse(String(init?.body));
      assert.equal(request.model, "openai/gpt-oss-20b-test");
      assert.equal(request.response_format.json_schema.strict, true);
      assert.equal(request.response_format.json_schema.schema.additionalProperties, false);
      assert.match(request.messages[1].content, /\[REDACTED_SECRET\]/);
      assert.doesNotMatch(request.messages[1].content, /gsk_abcdefghijklmnopqrstuvwxyz123456/);
      if (calls === 1) return new Response("", { status: 503 });
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ summary: "Keep local memory.", items: [{ kind: "decision", content: "Use SQLite.", status: "unknown", confidence: 0.9 }] }) } }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const result = await extractContext("Decision: use SQLite. Key: gsk_abcdefghijklmnopqrstuvwxyz123456");
    assert.equal(calls, 2);
    assert.equal(result.engine, "groq");
    assert.equal(result.summary, "Keep local memory.");
    assert.equal(result.items[0]?.kind, "decision");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GROQ_MODEL;
    else process.env.GROQ_MODEL = oldModel;
  }
});

test("Groq rate limits immediately use local extraction and explain why", async () => {
  const oldKey = process.env.GROQ_API_KEY;
  const oldFetch = globalThis.fetch;
  process.env.GROQ_API_KEY = "test-key";
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; return new Response("provider details are not surfaced", { status: 429 }); };
    const result = await extractContext("Implement login redirect after the authentication UI is complete.");
    assert.equal(calls, 1);
    assert.equal(result.engine, "local-fallback");
    assert.match(result.notice ?? "", /rate limit reached/i);
    assert.match(result.summary, /login redirect/i);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = oldKey;
  }
});

test("Groq timeouts use local extraction", async () => {
  const oldKey = process.env.GROQ_API_KEY;
  const oldTimeout = process.env.GROQ_TIMEOUT_MS;
  const oldFetch = globalThis.fetch;
  process.env.GROQ_API_KEY = "test-key";
  process.env.GROQ_TIMEOUT_MS = "1000";
  try {
    globalThis.fetch = async (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "TimeoutError")), { once: true });
    });
    const result = await extractContext("The login redirect is still pending and needs implementation.");
    assert.equal(result.engine, "local-fallback");
    assert.match(result.notice ?? "", /timed out/i);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = oldKey;
    if (oldTimeout === undefined) delete process.env.GROQ_TIMEOUT_MS;
    else process.env.GROQ_TIMEOUT_MS = oldTimeout;
  }
});

test("provider health reflects configured credentials without exposing them", () => {
  const oldKey = process.env.GROQ_API_KEY;
  try {
    delete process.env.GROQ_API_KEY;
    assert.equal(configuredExtractionProvider(), "local");
    process.env.GROQ_API_KEY = "configured-secret";
    assert.equal(configuredExtractionProvider(), "groq");
  } finally {
    if (oldKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = oldKey;
  }
});
