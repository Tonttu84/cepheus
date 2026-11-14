import { describe, expect, it } from "vitest";
import {
  collectOpen,
  formatRow,
  isOpen,
  parseRequests,
  parseSeen,
  rowKey,
  selectToShow,
} from "../../../scripts/requests-core.mjs";

const doc = [
  "# Requests between team members",
  "",
  "Some text | with a pipe.",
  "",
  "| Date | From | To | Request | Status |",
  "| --- | --- | --- | --- | --- |",
  "| 14 Nov 2026 | the project owner | the team | Approve trail 28. | open |",
  "| 14 Nov 2026 | a teammate | whoever reviews | Look at trail 25. | done |",
  "| 15 Nov 2026 | a teammate | the team | Bring a charger. | Done in trail 40 |",
  "",
  "| Date | From | To | Request | Status |",
  "| --- | --- | --- | --- | --- |",
  "| 1 Jan 2027 | x | y | In a later table. | open |",
].join("\r\n");

describe("parseRequests", () => {
  it("reads the rows of the first request table only", () => {
    const rows = parseRequests(doc);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      date: "14 Nov 2026",
      from: "the project owner",
      to: "the team",
      request: "Approve trail 28.",
      status: "open",
    });
  });

  it("returns nothing for a file without a table", () => {
    expect(parseRequests("# Nothing here\n\nJust text.")).toEqual([]);
    expect(parseRequests("")).toEqual([]);
  });

  it("skips rows with too few cells", () => {
    const short = "| Date | From | To | Request | Status |\n| --- | --- |\n| a | b |\n";
    expect(parseRequests(short)).toEqual([]);
  });
});

describe("isOpen and collectOpen", () => {
  it("treats a status starting with done as closed, whatever the case", () => {
    const rows = parseRequests(doc);
    expect(rows.map(isOpen)).toEqual([true, false, false]);
  });

  it("merges copies of the file and keeps each open request once", () => {
    const other = doc.replace("Approve trail 28.", "Approve trail 29.");
    const open = collectOpen([doc, other, doc]);
    expect(open.map((row) => row.request)).toEqual(["Approve trail 28.", "Approve trail 29."]);
  });

  it("keeps a request as one key when only its status changes", () => {
    const [row] = parseRequests(doc);
    expect(rowKey({ ...row, status: "waiting" })).toBe(rowKey(row));
  });
});

describe("seen file", () => {
  it("reads missing, broken or wrongly shaped text as empty", () => {
    expect(parseSeen(null).size).toBe(0);
    expect(parseSeen("not json").size).toBe(0);
    expect(parseSeen('{"a":1}').size).toBe(0);
    expect([...parseSeen('["a", 2, "b"]')]).toEqual(["a", "b"]);
  });

  it("shows only unseen rows and records them", () => {
    const open = collectOpen([doc]);
    const first = selectToShow(open, new Set(), false);
    expect(first.toShow).toHaveLength(1);
    const second = selectToShow(open, new Set(first.seen), false);
    expect(second.toShow).toEqual([]);
    expect(second.seen).toEqual(first.seen);
  });

  it("shows every open row again with showAll", () => {
    const open = collectOpen([doc]);
    const seen = new Set(selectToShow(open, new Set(), false).seen);
    expect(selectToShow(open, seen, true).toShow).toHaveLength(1);
  });
});

describe("formatRow", () => {
  it("puts date, sender, addressee and request on one line", () => {
    const [row] = parseRequests(doc);
    expect(formatRow(row)).toBe(
      "Request (14 Nov 2026) from the project owner to the team: Approve trail 28.",
    );
  });
});
