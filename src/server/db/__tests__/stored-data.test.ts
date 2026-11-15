import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { StoredDataError } from "../errors";
import { parseStoredEnum, parseStoredJson } from "../stored-data";
import { createWarningRepository } from "../effects";
import { createCallRepository } from "../calls";
import type { DbContext } from "../context";

describe("Stored data parsing helpers (stored-data.ts)", () => {
  const SampleEnum = z.enum(["alpha", "beta", "gamma"]);

  describe("parseStoredJson", () => {
    it("parses valid JSON matching the schema", () => {
      const result = parseStoredJson('["alpha", "beta"]', z.array(z.string()), "items");
      expect(result).toEqual(["alpha", "beta"]);
    });

    it("throws StoredDataError naming the column on invalid JSON syntax", () => {
      expect(() => parseStoredJson("not json", z.string(), "config")).toThrow(StoredDataError);
      expect(() => parseStoredJson("not json", z.string(), "config")).toThrow("Stored config is not valid JSON");
    });

    it("throws StoredDataError naming the column when JSON does not match schema", () => {
      expect(() => parseStoredJson("123", z.string(), "name")).toThrow(StoredDataError);
      expect(() => parseStoredJson("123", z.string(), "name")).toThrow("Stored name does not have the expected shape");
    });
  });

  describe("parseStoredEnum", () => {
    it("returns valid enum values as checked types", () => {
      const val = parseStoredEnum("alpha", SampleEnum, "sample_field");
      expect(val).toBe("alpha");
    });

    it("throws StoredDataError naming the column on unknown enum values without leaking the raw value", () => {
      const secretBogusValue = "UNEXPECTED_SECRET_VALUE";
      expect(() => parseStoredEnum(secretBogusValue, SampleEnum, "sample_field")).toThrow(StoredDataError);

      try {
        parseStoredEnum(secretBogusValue, SampleEnum, "sample_field");
        expect.unreachable("Should have thrown StoredDataError");
      } catch (err) {
        expect(err).toBeInstanceOf(StoredDataError);
        expect((err as Error).message).toBe("Stored sample_field does not have the expected shape");
        expect((err as Error).message).not.toContain(secretBogusValue);
      }
    });

    it("throws StoredDataError on non-string or null values", () => {
      expect(() => parseStoredEnum(null, SampleEnum, "sample_field")).toThrow(StoredDataError);
      expect(() => parseStoredEnum(42, SampleEnum, "sample_field")).toThrow(StoredDataError);
    });
  });
});

describe("Stored values parsed in repositories (effects.ts & calls.ts)", () => {
  function makeMockContext(mockClient: unknown): DbContext {
    return {
      client: () => mockClient as unknown as Prisma.TransactionClient,
      isInUnitOfWork: () => false,
      unitOfWork: {
        execute: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
          fn(mockClient as unknown as Prisma.TransactionClient),
      },
      storeItemAnswers: false,
      answers: () => ({} as unknown as ReturnType<DbContext["answers"]>),
    };
  }

  describe("WarningRepository.getWarnings (triggerKind)", () => {
    it("parses valid stored warning triggerKind values", async () => {
      const mockFindMany = async () => [
        {
          id: "flag-1",
          triggerKind: "silence",
          sinceDate: "2026-11-01",
          ruleVersion: 1,
          createdAt: new Date("2026-11-01T12:00:00Z"),
          causeType: "phq9",
          causeRoundNumber: null,
          causeDate: "2026-11-01",
        },
        {
          id: "flag-2",
          triggerKind: "gad7",
          sinceDate: "2026-11-05",
          ruleVersion: 1,
          createdAt: new Date("2026-11-05T12:00:00Z"),
          causeType: "gad7",
          causeRoundNumber: null,
          causeDate: "2026-11-05",
        },
      ];

      const ctx = makeMockContext({ clinicFlag: { findMany: mockFindMany } });
      const repo = createWarningRepository(ctx);
      const warnings = await repo.getWarnings("patient-1");

      expect(warnings).toHaveLength(2);
      expect(warnings[0].kind).toBe("silence");
      expect(warnings[1].kind).toBe("gad7");
    });

    it("throws StoredDataError when triggerKind in database is not a valid WarningKind", async () => {
      const mockFindMany = async () => [
        {
          id: "flag-1",
          triggerKind: "unknown_corrupt_kind",
          sinceDate: "2026-11-01",
          ruleVersion: 1,
          createdAt: new Date("2026-11-01T12:00:00Z"),
          causeType: "phq9",
          causeRoundNumber: null,
          causeDate: "2026-11-01",
        },
      ];

      const ctx = makeMockContext({ clinicFlag: { findMany: mockFindMany } });
      const repo = createWarningRepository(ctx);

      await expect(repo.getWarnings("patient-1")).rejects.toBeInstanceOf(StoredDataError);
      await expect(repo.getWarnings("patient-1")).rejects.toThrow("Stored triggerKind does not have the expected shape");
    });
  });

  describe("CallRepository.getCalls (position)", () => {
    it("parses valid call positions (before, after) and handles missing position", async () => {
      const mockFindMany = async () => [
        {
          id: "call-1",
          date: "2026-11-01",
          position: "before",
          requestedAt: new Date("2026-11-01T10:00:00Z"),
        },
        {
          id: "call-2",
          date: "2026-11-02",
          position: "after",
          requestedAt: new Date("2026-11-02T10:00:00Z"),
        },
        {
          id: "call-3",
          date: "2026-11-03",
          position: null,
          requestedAt: new Date("2026-11-03T10:00:00Z"),
        },
      ];

      const ctx = makeMockContext({ nurseCallRecord: { findMany: mockFindMany } });
      const repo = createCallRepository(ctx);
      const calls = await repo.getCalls("patient-1");

      expect(calls).toEqual([
        { patientId: "patient-1", date: "2026-11-01", position: "before" },
        { patientId: "patient-1", date: "2026-11-02", position: "after" },
        { patientId: "patient-1", date: "2026-11-03" },
      ]);
    });

    it("throws StoredDataError when position in database is not a valid CallPosition", async () => {
      const mockFindMany = async () => [
        {
          id: "call-1",
          date: "2026-11-01",
          position: "invalid_call_position",
          requestedAt: new Date("2026-11-01T10:00:00Z"),
        },
      ];

      const ctx = makeMockContext({ nurseCallRecord: { findMany: mockFindMany } });
      const repo = createCallRepository(ctx);

      await expect(repo.getCalls("patient-1")).rejects.toBeInstanceOf(StoredDataError);
      await expect(repo.getCalls("patient-1")).rejects.toThrow("Stored position does not have the expected shape");
    });
  });
});
