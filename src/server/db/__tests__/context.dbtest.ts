import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { createDbContext } from "../context";

describe("Database context and unit of work (*.dbtest.ts)", () => {
  let prisma: PrismaClient;
  const codes = ["ctx-commit", "ctx-rollback", "ctx-inside", "ctx-a", "ctx-b"];

  beforeAll(() => {
    prisma = getPrisma();
  });

  afterAll(async () => {
    await prisma.clinic.deleteMany({ where: { code: { in: codes } } });
    await prisma.$disconnect();
  });

  it("uses the plain client outside a unit of work", () => {
    const ctx = createDbContext(prisma);
    expect(ctx.isInUnitOfWork()).toBe(false);
    expect(ctx.client()).toBe(prisma);
  });

  it("keeps the writes of a unit of work that ends without an error and returns its result", async () => {
    const ctx = createDbContext(prisma);
    const result = await ctx.unitOfWork.execute(async () => {
      expect(ctx.isInUnitOfWork()).toBe(true);
      await ctx.client().clinic.create({ data: { code: "ctx-commit", name: "Commit" } });
      return "done";
    });
    expect(result).toBe("done");
    expect(ctx.isInUnitOfWork()).toBe(false);
    expect(await prisma.clinic.count({ where: { code: "ctx-commit" } })).toBe(1);
  });

  it("keeps none of the writes of a unit of work that throws, and passes the error on", async () => {
    const ctx = createDbContext(prisma);
    await expect(
      ctx.unitOfWork.execute(async () => {
        await ctx.client().clinic.create({ data: { code: "ctx-rollback", name: "Rollback" } });
        throw new Error("stop this unit");
      })
    ).rejects.toThrow("stop this unit");
    expect(await prisma.clinic.count({ where: { code: "ctx-rollback" } })).toBe(0);
  });

  it("gives the transaction to code inside the unit: its own write is visible there and not outside before the end", async () => {
    const ctx = createDbContext(prisma);
    await ctx.unitOfWork.execute(async () => {
      await ctx.client().clinic.create({ data: { code: "ctx-inside", name: "Inside" } });
      expect(await ctx.client().clinic.count({ where: { code: "ctx-inside" } })).toBe(1);
      expect(await prisma.clinic.count({ where: { code: "ctx-inside" } })).toBe(0);
    });
    expect(await prisma.clinic.count({ where: { code: "ctx-inside" } })).toBe(1);
  });

  it("keeps two units that run at the same time apart: one rolls back, the other is kept", async () => {
    const ctx = createDbContext(prisma);
    const kept = ctx.unitOfWork.execute(async () => {
      await ctx.client().clinic.create({ data: { code: "ctx-a", name: "A" } });
      await new Promise((resolve) => setTimeout(resolve, 50));
      await ctx.client().clinic.update({ where: { code: "ctx-a" }, data: { name: "A2" } });
    });
    const undone = ctx.unitOfWork.execute(async () => {
      await ctx.client().clinic.create({ data: { code: "ctx-b", name: "B" } });
      throw new Error("undo b");
    });
    await expect(undone).rejects.toThrow("undo b");
    await kept;
    expect((await prisma.clinic.findUnique({ where: { code: "ctx-a" } }))?.name).toBe("A2");
    expect(await prisma.clinic.count({ where: { code: "ctx-b" } })).toBe(0);
  });
});
