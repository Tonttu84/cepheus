import { describe, expect, it } from "vitest";
import { safeReturnUrl } from "@/lib/safe-return-url";

describe("safeReturnUrl (Fix B)", () => {
  it("accepts valid application return paths", () => {
    expect(safeReturnUrl("/clinic")).toBe("/clinic");
    expect(safeReturnUrl("/demo?x=1")).toBe("/demo?x=1");
    expect(safeReturnUrl("/check-in")).toBe("/check-in");
    expect(safeReturnUrl("/patient")).toBe("/patient");
    expect(safeReturnUrl("/monitoring?view=summary&filter=all")).toBe(
      "/monitoring?view=summary&filter=all"
    );
    expect(safeReturnUrl("/")).toBe("/");
  });

  it("rejects newline cases including percent-encoded variants", () => {
    expect(safeReturnUrl("/%0a/evil.example")).toBeNull();
    expect(safeReturnUrl("/%0A/evil.example")).toBeNull();
    expect(safeReturnUrl("/\n/evil.example")).toBeNull();
    expect(safeReturnUrl("/%0d%0a/evil.example")).toBeNull();
  });

  it("rejects tab and whitespace cases including percent-encoded variants", () => {
    expect(safeReturnUrl("/\t/evil.example")).toBeNull();
    expect(safeReturnUrl("/%09/evil.example")).toBeNull();
    expect(safeReturnUrl("/ /evil.example")).toBeNull();
    expect(safeReturnUrl("/%20/evil.example")).toBeNull();
    expect(safeReturnUrl(" /clinic")).toBeNull();
    expect(safeReturnUrl("/clinic ")).toBeNull();
  });

  it("rejects protocol-relative double-slash URLs", () => {
    expect(safeReturnUrl("//evil")).toBeNull();
    expect(safeReturnUrl("//evil.example.com")).toBeNull();
    expect(safeReturnUrl("///evil")).toBeNull();
    expect(safeReturnUrl("/%2fevil")).toBeNull();
    expect(safeReturnUrl("/%2F/evil")).toBeNull();
  });

  it("rejects backslash and encoded backslash", () => {
    expect(safeReturnUrl("/\\evil")).toBeNull();
    expect(safeReturnUrl("/path\\evil")).toBeNull();
    expect(safeReturnUrl("/%5cevil")).toBeNull();
    expect(safeReturnUrl("/%5Cevil")).toBeNull();
  });

  it("rejects colons and scheme indicators", () => {
    expect(safeReturnUrl("/http://evil.example")).toBeNull();
    expect(safeReturnUrl("/:evil")).toBeNull();
    expect(safeReturnUrl("/%3a/evil")).toBeNull();
    expect(safeReturnUrl("/%3A/evil")).toBeNull();
  });

  it("rejects invalid percent-encoded values that fail to decode", () => {
    expect(safeReturnUrl("/%ZZ")).toBeNull();
    expect(safeReturnUrl("/%E0%A4%A")).toBeNull();
  });

  it("rejects null, undefined, empty, and non-slash-starting values", () => {
    expect(safeReturnUrl(null)).toBeNull();
    expect(safeReturnUrl(undefined)).toBeNull();
    expect(safeReturnUrl("")).toBeNull();
    expect(safeReturnUrl("clinic")).toBeNull();
    expect(safeReturnUrl("https://evil.example")).toBeNull();
    expect(safeReturnUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects characters outside the allowed safe path set (A-Za-z0-9-._~/?=&%)", () => {
    expect(safeReturnUrl("/clinic#anchor")).toBeNull();
    expect(safeReturnUrl("/clinic<script>")).toBeNull();
    expect(safeReturnUrl('/clinic"quote')).toBeNull();
  });
});
