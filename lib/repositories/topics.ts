import { getDb } from "@/lib/db";
import { Topic } from "@/lib/types";

type TopicRow = {
  id: number;
  name: string;
  query: string;
  is_active: number;
  allocation_percent: number;
  display_order: number;
};

export function listTopics(): Topic[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT id, name, query, is_active, allocation_percent, display_order
      FROM topics
      ORDER BY display_order ASC, id ASC
    `
    )
    .all() as TopicRow[];
  return rows
    .map(
      (row) =>
        ({
          id: row.id,
          name: row.name,
          query: row.query,
          isActive: row.is_active === 1,
          allocationPercent: row.allocation_percent,
          displayOrder: row.display_order
        }) satisfies Topic
    );
}

export function upsertTopics(topics: Array<Omit<Topic, "id"> & { id?: number }>): void {
  const db = getDb();
  const now = new Date().toISOString();

  const insert = db.prepare(`
    INSERT INTO topics(name, query, is_active, allocation_percent, display_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const update = db.prepare(`
    UPDATE topics
    SET name=?, query=?, is_active=?, allocation_percent=?, display_order=?, updated_at=?
    WHERE id=?
  `);

  const tx = db.transaction(() => {
    for (const topic of topics) {
      if (!topic.name.trim() || !topic.query.trim()) continue;
      if (topic.id) {
        update.run(
          topic.name.trim(),
          topic.query.trim(),
          topic.isActive ? 1 : 0,
          topic.allocationPercent,
          topic.displayOrder,
          now,
          topic.id
        );
      } else {
        insert.run(
          topic.name.trim(),
          topic.query.trim(),
          topic.isActive ? 1 : 0,
          topic.allocationPercent,
          topic.displayOrder,
          now,
          now
        );
      }
    }
  });

  tx();
}
