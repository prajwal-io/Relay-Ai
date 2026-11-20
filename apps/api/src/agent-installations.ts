import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";
import type { AgentId } from "../../../packages/shared/src/agents.js";

/** Detection does not execute binaries or inspect provider profiles. */
export async function detectAgent(id: AgentId) {
  const folders = (process.env.PATH ?? "").split(delimiter).filter(isAbsolute);
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".ps1"] : [""];
  for (const folder of folders) for (const ext of extensions) {
    try {
      await access(join(folder, id + ext), constants.X_OK);
      return { state: "detected", detail: "Command found on PATH" };
    } catch { /* Some installations expose only a graphical application. */ }
  }
  return { state: "unknown", detail: "Command not found on PATH" };
}
