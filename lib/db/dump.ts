import { z } from "zod";
import { ensureDefaults } from "@/lib/db/repositories";
import { getDb } from "@/lib/db/schema";

const dumpSchema = z.record(z.string(), z.array(z.record(z.string(), z.unknown())));

export type ToolgapDump = z.infer<typeof dumpSchema>;

export async function exportDump(): Promise<ToolgapDump> {
  const db = getDb();
  const dump: ToolgapDump = {};
  for (const table of db.tables) {
    dump[table.name] = (await table.toArray()) as Array<Record<string, unknown>>;
  }
  return dump;
}

export async function importDump(
  raw: unknown,
): Promise<{ tables: number; rows: number }> {
  const tables = dumpSchema.parse(raw);
  const db = getDb();
  const known = new Set(db.tables.map((table) => table.name));
  for (const name of Object.keys(tables)) {
    if (!known.has(name)) {
      throw new Error(`Unknown table "${name}"`);
    }
  }

  let rows = 0;
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
      const data = tables[table.name] ?? [];
      if (data.length === 0) continue;
      await table.bulkPut(data as never);
      rows += data.length;
    }
  });
  await ensureDefaults();
  return { tables: db.tables.length, rows };
}
