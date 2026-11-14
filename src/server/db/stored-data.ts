import type { z } from "zod";
import { StoredDataError } from "./errors";

/** Parses a JSON column into a checked value; anything else is a StoredDataError naming the column only. */
export function parseStoredJson<T>(text: string, schema: z.ZodType<T>, column: string): T {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new StoredDataError(`Stored ${column} is not valid JSON`);
  }
  const result = schema.safeParse(value);
  if (!result.success) throw new StoredDataError(`Stored ${column} does not have the expected shape`);
  return result.data;
}

/** Parses a stored enum column into a checked value; anything else is a StoredDataError naming the column only. */
export function parseStoredEnum<T>(value: unknown, schema: z.ZodType<T>, column: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new StoredDataError(`Stored ${column} does not have the expected shape`);
  return result.data;
}
