import { access, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Evidence, MemoryItem } from "../../../packages/shared/src/contracts.js";

const exec = promisify(execFile);

export async function validateRootPath(input: unknown): Promise<string> {
  if (typeof input !== "string" || !input.trim() || !isAbsolute(input)) {
    throw Object.assign(new Error("rootPath must be an absolute path"), { status: 400, code: "INVALID_ROOT" });
  }
  try {
    return await realpath(input);
  } catch {
    throw Object.assign(new Error("Project directory does not exist or is inaccessible"), { status: 400, code: "ROOT_NOT_FOUND" });
  }
}

export function resolveProjectFile(root: string, relativePath: string): string {
  const target = resolve(root, relativePath);
  const rel = relative(root, target);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw Object.assign(new Error("File path must stay inside the registered project"), { status: 400, code: "PATH_OUTSIDE_PROJECT" });
  }
  return target;
}

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await exec("git", ["-C", root, ...args], { timeout: 5000, maxBuffer: 200_000, windowsHide: true });
  return stdout.trim();
}

export async function collectRepositoryEvidence(root: string, items: MemoryItem[]): Promise<{ evidence: Evidence[]; conflicts: string[] }> {
  const evidence: Evidence[] = [];
  const conflicts: string[] = [];
  const observedAt = new Date().toISOString();
  let insideRepo = false;
  try {
    insideRepo = (await git(root, ["rev-parse", "--show-toplevel"])).length > 0;
  } catch { /* a registered directory can be useful without Git */ }
  if (!insideRepo) {
    return { evidence: [{ kind: "git-status", status: "unverified", description: "Directory is not a Git repository; repository state could not be checked.", observedAt, source: "repository" }], conflicts };
  }
  try {
    const status = await git(root, ["status", "--short", "--branch"]);
    evidence.push({ kind: "git-status", status: "verified", description: `Observed Git working tree status: ${status || "clean"}.`, observedAt, source: "repository" });
  } catch {
    evidence.push({ kind: "git-status", status: "unverified", description: "Git status could not be read.", observedAt, source: "repository" });
  }
  for (const item of items) {
    const pathMatches = item.content.match(/(?:^|\s)([\w@./\\-]+\.[a-zA-Z0-9]{1,8})(?=$|[\s:])/g) ?? [];
    for (const match of pathMatches.slice(0, 8)) {
      const path = match.trim().replace(/[\\]/g, "/").replace(/^\.\//, "");
      if (path.startsWith("../") || path.includes(":\\")) continue;
      try {
        resolveProjectFile(root, path);
        const output = await git(root, ["ls-files", "--error-unmatch", "--", path]);
        evidence.push({ kind: "file-exists", status: "verified", description: `Tracked repository file exists: ${path}.`, path, observedAt, source: "repository" });
        if (item.kind === "task" && item.status === "complete" && output) {
          const diff = await git(root, ["diff", "--", path]);
          const cached = await git(root, ["diff", "--cached", "--", path]);
          if (diff || cached) evidence.push({ kind: "git-diff", status: "verified", description: `Git reports changes for ${path}; this does not by itself establish task completion.`, path, observedAt, source: "repository" });
        }
      } catch {
        try {
          const target = resolveProjectFile(root, path);
          const resolved = await realpath(target);
          const rel = relative(root, resolved);
          if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error("path escaped root");
          await access(resolved);
          evidence.push({ kind: "file-exists", status: "unverified", description: `File exists in the working tree but is not tracked by Git: ${path}.`, path, observedAt, source: "repository" });
        } catch {
          evidence.push({ kind: "file-exists", status: "conflict", description: `Referenced file is missing from the project working tree: ${path}.`, path, observedAt, source: "repository" });
          conflicts.push(`Memory item ${item.id} references ${path}, which is missing from the working tree.`);
        }
      }
    }
  }
  return { evidence, conflicts };
}
