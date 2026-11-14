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

  it("skips a row with too few cells (e.g. 4 cells in a 5-column table)", () => {
    const fourCells = [
      "| Date | From | To | Request | Status |",
      "| --- | --- | --- | --- | --- |",
      "| 14 Nov 2026 | user | team | missing status |",
    ].join("\n");
    expect(parseRequests(fourCells)).toEqual([]);
  });

  it("parses a row with too many cells by taking the first 5 columns and ignoring extra cells", () => {
    const tooManyCells = [
      "| Date | From | To | Request | Status |",
      "| --- | --- | --- | --- | --- |",
      "| 14 Nov 2026 | user | team | request text | open | extra column | trailing notes |",
    ].join("\n");
    const rows = parseRequests(tooManyCells);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      date: "14 Nov 2026",
      from: "user",
      to: "team",
      request: "request text",
      status: "open",
    });
  });

  it("returns an empty array for an empty file or whitespace-only file", () => {
    expect(parseRequests("")).toEqual([]);
    expect(parseRequests("   \r\n\t  \r\n   ")).toEqual([]);
  });

  it("parses markdown with CRLF (\\r\\n) line endings correctly", () => {
    const crlfDoc = "| Date | From | To | Request | Status |\r\n| --- | --- | --- | --- | --- |\r\n| 14 Nov 2026 | user | team | task | open |\r\n";
    const rows = parseRequests(crlfDoc);
    expect(rows).toEqual([
      {
        date: "14 Nov 2026",
        from: "user",
        to: "team",
        request: "task",
        status: "open",
      },
    ]);
  });

  it.fails("parses a table cell containing an escaped pipe (\\|)", () => {
    // Bug in scripts/requests-core.mjs:12: splitCells naively splits on '|' even when escaped as '\|' in input "| 14 Nov 2026 | user | team | fix a \| b | open |"
    const docWithEscapedPipe = [
      "| Date | From | To | Request | Status |",
      "| --- | --- | --- | --- | --- |",
      "| 14 Nov 2026 | user | team | fix a \\| b | open |",
    ].join("\n");
    const rows = parseRequests(docWithEscapedPipe);
    expect(rows).toHaveLength(1);
    expect(rows[0].request).toBe("fix a | b");
    expect(rows[0].status).toBe("open");
  });
});

describe("isOpen and collectOpen", () => {
  it("treats a status starting with done as closed, whatever the case", () => {
    const rows = parseRequests(doc);
    expect(rows.map(isOpen)).toEqual([true, false, false]);
  });

  it("handles status with trailing spaces and different case in parseRequests and isOpen", () => {
    const docCaseSpaces = [
      "| Date | From | To | Request | Status |",
      "| --- | --- | --- | --- | --- |",
      "| 14 Nov 2026 | a | b | task 1 | OPEN   |",
      "| 15 Nov 2026 | c | d | task 2 |  DoNe in trail 40   |",
      "| 16 Nov 2026 | e | f | task 3 | dOnE   |",
      "| 17 Nov 2026 | g | h | task 4 |   wAiTiNg  |",
    ].join("\n");
    const rows = parseRequests(docCaseSpaces);
    expect(rows).toHaveLength(4);
    expect(rows[0].status).toBe("OPEN");
    expect(rows[1].status).toBe("DoNe in trail 40");
    expect(rows[2].status).toBe("dOnE");
    expect(rows[3].status).toBe("wAiTiNg");

    expect(isOpen(rows[0])).toBe(true);
    expect(isOpen(rows[1])).toBe(false);
    expect(isOpen(rows[2])).toBe(false);
    expect(isOpen(rows[3])).toBe(true);

    expect(isOpen({ date: "d", from: "f", to: "t", request: "r", status: "  DONE   " })).toBe(false);
    expect(isOpen({ date: "d", from: "f", to: "t", request: "r", status: "Done   " })).toBe(false);
    expect(isOpen({ date: "d", from: "f", to: "t", request: "r", status: "  done   " })).toBe(false);
    expect(isOpen({ date: "d", from: "f", to: "t", request: "r", status: "  OPEN   " })).toBe(true);
    expect(isOpen({ date: "d", from: "f", to: "t", request: "r", status: "Open   " })).toBe(true);
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

  it("gives no open row when done in the first document and open in the second", () => {
    const doneDoc = [
      "| Date | From | To | Request | Status |",
      "| --- | --- | --- | --- | --- |",
      "| 14 Nov 2026 | the project owner | the team | Approve trail 28. | done |",
    ].join("\n");
    const openDoc = [
      "| Date | From | To | Request | Status |",
      "| --- | --- | --- | --- | --- |",
      "| 14 Nov 2026 | the project owner | the team | Approve trail 28. | open |",
    ].join("\n");

    expect(collectOpen([doneDoc, openDoc])).toEqual([]);
  });

  it("stays open when open in the first document and done in the second, since the first decides", () => {
    const openDoc = [
      "| Date | From | To | Request | Status |",
      "| --- | --- | --- | --- | --- |",
      "| 14 Nov 2026 | the project owner | the team | Approve trail 28. | open |",
    ].join("\n");
    const doneDoc = [
      "| Date | From | To | Request | Status |",
      "| --- | --- | --- | --- | --- |",
      "| 14 Nov 2026 | the project owner | the team | Approve trail 28. | done |",
    ].join("\n");

    const open = collectOpen([openDoc, doneDoc]);
    expect(open).toHaveLength(1);
    expect(open[0]?.request).toBe("Approve trail 28.");
    expect(open[0]?.status).toBe("open");
  });

  it("returns an open request found only in the second document", () => {
    const firstDoc = [
      "| Date | From | To | Request | Status |",
      "| --- | --- | --- | --- | --- |",
      "| 14 Nov 2026 | the project owner | the team | Approve trail 28. | done |",
    ].join("\n");
    const secondDoc = [
      "| Date | From | To | Request | Status |",
      "| --- | --- | --- | --- | --- |",
      "| 15 Nov 2026 | a teammate | the team | Bring a charger. | open |",
    ].join("\n");

    const open = collectOpen([firstDoc, secondDoc]);
    expect(open.map((row) => row.request)).toEqual(["Bring a charger."]);
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
