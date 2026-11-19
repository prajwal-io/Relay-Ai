import { execFile } from "node:child_process";
import { access, lstat, readdir, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const MAX_CLONE_BYTES = 250 * 1024 * 1024;

async function directoryBytes(path: string): Promise<number> {
  let bytes = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) bytes += await directoryBytes(target);
    else if (entry.isFile()) bytes += (await lstat(target)).size;
  }
  return bytes;
}

async function cloneLimited(repositoryUrl: string, target: string) {
  const child = spawn("git", ["-c", "http.followRedirects=false", "clone", "--depth=1", "--filter=blob:limit=2m", repositoryUrl, target], {
    windowsHide: true, stdio: "ignore", env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1", GIT_LFS_SKIP_SMUDGE: "1" },
  });
  let reason: "timeout" | "size" | undefined;
  let finished = false;
  const timeout = setTimeout(() => { reason = "timeout"; child.kill(); }, 90_000);
  const monitor = (async () => {
    while (!finished) {
      await new Promise(resolve => setTimeout(resolve, 500));
      try { if (await directoryBytes(target) > MAX_CLONE_BYTES) { reason = "size"; child.kill(); return; } }
      catch { /* Clone may not have created its directory yet. */ }
    }
  })();
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", error => { finished = true; reject(error); });
      child.once("close", value => { finished = true; resolve(value); });
    });
    await monitor;
    if (reason === "timeout") throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
    if (reason === "size") throw Object.assign(new Error("size"), { code: "REPOSITORY_TOO_LARGE" });
    if (code !== 0) throw new Error(`git clone exited with status ${code}`);
  } finally { clearTimeout(timeout); }
}

export function parsePublicRepository(input: unknown): { url: string; name: string } {
  if (typeof input !== "string" || input.length > 500) throw new Error("Paste a public GitHub or GitLab repository URL.");
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error("Paste a valid public GitHub or GitLab repository URL."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash || !["github.com", "www.github.com", "gitlab.com", "www.gitlab.com"].includes(url.hostname.toLowerCase())) {
    throw new Error("Only public GitHub and GitLab HTTPS repository links are supported.");
  }
  let parts: string[];
  try { parts = decodeURIComponent(url.pathname).split("/").filter(Boolean); }
  catch { throw new Error("Use a valid repository link without encoded path characters."); }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "github.com" && parts.length !== 2) throw new Error("Use the repository home link, such as github.com/owner/project.");
  if (host === "gitlab.com") parts = parts.slice(0, parts.indexOf("-") >= 0 ? parts.indexOf("-") : parts.length);
  if (parts.length < 2 || parts.some(part => !/^[a-zA-Z0-9_.-]+$/.test(part) || part === "." || part === "..")) {
    throw new Error("Use the repository home link, such as github.com/owner/project.");
  }
  const last = parts.length - 1;
  parts[last] = parts[last].replace(/\.git$/i, "");
  if (!parts[last]) throw new Error("The repository URL is missing its project name.");
  return { url: `https://${host}/${parts.join("/")}.git`, name: parts[last] };
}

async function readSmallFile(root: string, file: string, maxBytes: number): Promise<string> {
  try {
    const target = join(root, file);
    const metadata = await lstat(target);
    if (!metadata.isFile() || metadata.size > maxBytes) return "";
    const content = await readFile(target, "utf8");
    return Buffer.byteLength(content) <= maxBytes ? content : content.slice(0, maxBytes);
  } catch { return ""; }
}

export async function cloneAndInspectRepository(repositoryUrl: string, target: string) {
  try {
    await cloneLimited(repositoryUrl, target);
    await access(join(target, ".git"));
    const [readme, packageJson, gitFiles] = await Promise.all([
      readSmallFile(target, "README.md", 16_000),
      readSmallFile(target, "package.json", 8_000),
      exec("git", ["-C", target, "ls-files", "-z"], { timeout: 10_000, maxBuffer: 1_000_000, windowsHide: true }),
    ]);
    let description = "";
    if (packageJson) {
      try { description = String(JSON.parse(packageJson).description ?? "").slice(0, 240); } catch { /* malformed manifests are only previews */ }
    }
    const files = gitFiles.stdout.split("\0").filter(Boolean);
    const folders = [...new Set(files.map(file => file.split("/")[0]).filter(folder => folder && !folder.includes(".")))].slice(0, 6);
    return {
      trackedFileCount: files.length,
      folders,
      description,
      readme: readme.slice(0, 1_400).trim(),
      keyFiles: files.filter(file => /^(README(?:\.md)?|package\.json|pyproject\.toml|Cargo\.toml|go\.mod|src\/)/i.test(file)).slice(0, 8),
    };
  } catch (error) {
    await rm(target, { recursive: true, force: true }).catch(() => {});
    const message = (error as any)?.code === "REPOSITORY_TOO_LARGE"
      ? "That repository exceeds Relay’s 250 MB import limit. Choose a smaller repository."
      : error instanceof Error && error.name === "TimeoutError"
      ? "That repository took too long to download. Try again on a faster connection or choose a smaller repository."
      : "Could not download this repository. Check that the URL is public and Git is installed, then try again.";
    throw Object.assign(new Error(message), { status: 400, code: "REPOSITORY_IMPORT_FAILED" });
  }
}
