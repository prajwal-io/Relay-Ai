import type { HandoffReceipt } from "../../../packages/shared/src/contracts.js";

function fence(value: string): string {
  const runs = value.match(/`+/g) ?? [];
  const marker = "`".repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
  return `${marker}\n${value}\n${marker}`;
}

function inline(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+\-.!|>]/g, "\\$&").replace(/[<>]/g, character => character === "<" ? "&lt;" : "&gt;").replace(/[\r\n]+/g, " ");
}

/** A local Markdown download; user-provided content is fenced so it cannot forge receipt structure. */
export function formatReceiptMarkdown(receipt: HandoffReceipt, title: string, source: string): string {
  const lines = [
    "# Relay AI · Proof of Continuity", "",
    `- Handoff: ${inline(title)}`,
    `- Route: ${inline(source)} → ${inline(receipt.destination)}`,
    `- Retrieved: ${receipt.retrievedAt ? new Date(receipt.retrievedAt).toISOString() : "Not recorded"}`,
    `- Retrievals recorded: ${receipt.retrievalCount}`,
    `- Repository state now: ${receipt.repositoryStatus}`, "",
    "## Approved context returned", "",
  ];
  if (receipt.approvedItems.length) {
    for (const item of receipt.approvedItems) {
      lines.push(`### ${inline(item.kind)}${item.status ? ` · ${inline(item.status)}` : ""}`, "", fence(item.content), "");
    }
  } else lines.push("No context items were returned.", "");
  lines.push("## Repository evidence at retrieval", "");
  for (const entry of receipt.evidence) lines.push(`- **${inline(entry.status)}** ${fence(entry.description)}`);
  if (!receipt.evidence.length) lines.push("No repository evidence was recorded.");
  lines.push("", "## Conflicts", "");
  if (receipt.conflicts.length) for (const conflict of receipt.conflicts) lines.push(fence(conflict), "");
  else lines.push("None recorded in the retrieved evidence.", "");
  lines.push("This receipt records Relay returning the approved package to the destination integration. It does not prove the destination model read or understood the context.", "");
  return lines.join("\n");
}
