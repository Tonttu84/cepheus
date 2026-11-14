// Prints open requests from docs/requests.md that this machine has not shown yet.
// Usage: node scripts/check-requests.mjs [--all]
// It never fails loudly: on any error it prints one line and exits 0.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { collectOpen, formatRow, parseSeen, selectToShow } from "./requests-core.mjs";

const FILE = "docs/requests.md";

function git(args, timeout = 10_000) {
  return execFileSync("git", args, {
    encoding: "utf8",
    timeout,
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true,
  });
}

function tryGit(args, timeout) {
  try {
    return git(args, timeout);
  } catch {
    return null;
  }
}

function readDocuments() {
  const refs = (tryGit(["for-each-ref", "--format=%(refname:short)", "refs/remotes/origin"]) ?? "")
    .split(/\r?\n/)
    .filter((ref) => ref && ref !== "origin" && ref !== "origin/HEAD");
  const ordered = ["origin/main", ...refs.filter((ref) => ref !== "origin/main")];
  return ordered.map((ref) => tryGit(["show", `${ref}:${FILE}`])).filter((doc) => doc !== null);
}

function seenPath() {
  // The common directory is shared by all worktrees, so a request shows once per clone.
  const gitDir = git(["rev-parse", "--git-common-dir"]).trim();
  return path.resolve(gitDir, "requests-seen.json");
}

function readText(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function main() {
  const showAll = process.argv.includes("--all");
  tryGit(["fetch", "--quiet", "origin"], 30_000);
  const open = collectOpen(readDocuments());
  const file = seenPath();
  const { toShow, seen } = selectToShow(open, parseSeen(readText(file)), showAll);
  for (const row of toShow) console.log(formatRow(row));
  if (toShow.length > 0) writeFileSync(file, `${JSON.stringify(seen, null, 2)}\n`);
}

try {
  main();
} catch {
  console.log("Requests could not be checked (git or docs/requests.md unavailable).");
}
process.exit(0);
