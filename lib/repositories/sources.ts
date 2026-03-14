import { getDb } from "@/lib/db";
import { Source } from "@/lib/types";

type SourceRow = {
  id: number;
  source_type: Source["sourceType"];
  source_name: string;
  is_active: number;
  config_json: string | null;
};

export function listSources(): Source[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT id, source_type, source_name, is_active, config_json
      FROM sources
      ORDER BY id ASC
    `
    )
    .all() as SourceRow[];
  return rows
    .map(
      (row) =>
        ({
          id: row.id,
          sourceType: row.source_type,
          sourceName: row.source_name,
          isActive: row.is_active === 1,
          configJson: row.config_json
        }) satisfies Source
    );
}

export function updateSources(
  sources: Array<{ id: number; isActive: boolean; configJson?: string | null }>
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `UPDATE sources SET is_active=?, config_json=?, updated_at=? WHERE id=?`
  );
  const tx = db.transaction(() => {
    for (const row of sources) {
      stmt.run(row.isActive ? 1 : 0, row.configJson ?? null, now, row.id);
    }
  });
  tx();
}
