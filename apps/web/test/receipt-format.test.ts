import assert from "node:assert/strict";
import test from "node:test";
import type { HandoffReceipt, MemoryItem } from "../../../packages/shared/src/contracts.js";
import { formatReceiptMarkdown } from "../src/receipt-format.js";

const item: MemoryItem = {
  id: "item-1", projectId: "project-1", kind: "task", content: "First line\n## Forged receipt section\n```nested```",
  source: "user", tags: [], evidence: [], createdAt: "2026-11-13T00:00:00.000Z", updatedAt: "2026-11-13T00:00:00.000Z",
};
const receipt: HandoffReceipt = {
  handoffId: "handoff-1", destination: "opencode", approvedItemIds: [item.id], approvedItems: [item],
  repositoryStatus: "stale", conflicts: ["Current source now conflicts\n## forged heading"],
  repositorySnapshot: "Repository snapshot: fixture", evidence: [{ kind: "file-exists", status: "conflict", description: "missing-file.ts", observedAt: "2026-11-13T00:00:00.000Z", source: "repository" }],
  retrievedAt: "2026-11-13T01:02:03.000Z", retrievalCount: 1, retrievals: [],
};

test("share export preserves approved context and flags while fencing untrusted content", () => {
  const markdown = formatReceiptMarkdown(receipt, "Migration `title`\n## Forged", "codex");
  assert.match(markdown, /Repository state now: stale/);
  assert.match(markdown, /Current source now conflicts/);
  assert.match(markdown, /First line\n## Forged receipt section\n```nested```/);
  assert.match(markdown, /```\nFirst line/);
  assert.match(markdown, /````\nFirst line[\s\S]*?````/);
  assert.match(markdown, /Migration \\`title\\` \\#\\# Forged/);
  assert.doesNotMatch(markdown, /- \\*\\*task.*First line\n## Forged receipt section/);
  assert.match(markdown, /does not prove the destination model read or understood/);
});
