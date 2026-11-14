// Pure logic for check-requests.mjs: no git, no files, no clock.
import { createHash } from "node:crypto";

/**
 * @typedef {{ date: string, from: string, to: string, request: string, status: string }} RequestRow
 */

/** Splits one Markdown table line into trimmed cells, or returns null. */
function splitCells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  return trimmed
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, "|").trim());
}

/**
 * Reads the request rows of the first table whose header starts with Date.
 * @param {string} markdown
 * @returns {RequestRow[]}
 */
export function parseRequests(markdown) {
  const rows = [];
  let inTable = false;
  for (const line of markdown.split(/\r?\n/)) {
    const cells = splitCells(line);
    if (!cells) {
      if (inTable) break;
      continue;
    }
    if (!inTable) {
      inTable = cells[0]?.toLowerCase() === "date";
      continue;
    }
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    if (cells.length < 5) continue;
    const [date, from, to, request, status] = cells;
    rows.push({ date, from, to, request, status });
  }
  return rows;
}

/** @param {RequestRow} row */
export function isOpen(row) {
  return !/^done\b/i.test(row.status.trim());
}

/** @param {RequestRow} row */
export function rowKey(row) {
  const text = [row.date, row.from, row.to, row.request].join("\u0000");
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/**
 * Open rows from several copies of the file, each request once.
 * @param {string[]} documents
 * @returns {RequestRow[]}
 */
export function collectOpen(documents) {
  const byKey = new Map();
  for (const doc of documents) {
    for (const row of parseRequests(doc)) {
      const key = rowKey(row);
      if (!byKey.has(key)) byKey.set(key, row);
    }
  }
  return [...byKey.values()].filter(isOpen);
}

/**
 * Parses the seen file's text into a set of keys; bad or missing text is empty.
 * @param {string | null} text
 * @returns {Set<string>}
 */
export function parseSeen(text) {
  if (!text) return new Set();
  try {
    const value = JSON.parse(text);
    if (!Array.isArray(value)) return new Set();
    return new Set(value.filter((key) => typeof key === "string"));
  } catch {
    return new Set();
  }
}

/**
 * Picks the rows to print and the keys to store afterwards.
 * @param {RequestRow[]} open
 * @param {Set<string>} seen
 * @param {boolean} showAll
 */
export function selectToShow(open, seen, showAll) {
  const toShow = showAll ? open : open.filter((row) => !seen.has(rowKey(row)));
  const nextSeen = new Set(seen);
  for (const row of toShow) nextSeen.add(rowKey(row));
  return { toShow, seen: [...nextSeen].sort() };
}

/** @param {RequestRow} row */
export function formatRow(row) {
  return `Request (${row.date}) from ${row.from} to ${row.to}: ${row.request}`;
}
