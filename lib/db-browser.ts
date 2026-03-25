import { getDb } from "@/lib/db";

export type TableColumn = {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: unknown;
  primaryKeyIndex: number;
};

export type TableSummary = {
  name: string;
  rowCount: number;
  columns: TableColumn[];
  primaryKeys: string[];
};

export type TableRowsResult = {
  table: TableSummary;
  rows: Record<string, unknown>[];
  totalRows: number;
  visibleRows: number;
  query: string;
  limit: number;
};

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function assertSafeTableName(table: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
    throw new Error("invalid table name");
  }
}

function getColumns(table: string): TableColumn[] {
  const db = getDb();
  return db
    .prepare(`PRAGMA table_info(${quoteIdentifier(table)})`)
    .all()
    .map((row) => {
      const info = row as {
        name: string;
        type: string;
        notnull: number;
        dflt_value: unknown;
        pk: number;
      };

      return {
        name: info.name,
        type: info.type,
        notNull: info.notnull === 1,
        defaultValue: info.dflt_value,
        primaryKeyIndex: info.pk
      };
    });
}

export function listTables(): TableSummary[] {
  const db = getDb();
  const tableRows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as Array<{ name: string }>;

  return tableRows.map(({ name }) => {
    const columns = getColumns(name);
    const [{ count }] = db.prepare(`SELECT COUNT(*) as count FROM ${quoteIdentifier(name)}`).all() as Array<{ count: number }>;
    const primaryKeys = columns
      .filter((column) => column.primaryKeyIndex > 0)
      .sort((a, b) => a.primaryKeyIndex - b.primaryKeyIndex)
      .map((column) => column.name);

    return {
      name,
      rowCount: count,
      columns,
      primaryKeys
    };
  });
}

export function getTableSummary(table: string): TableSummary {
  assertSafeTableName(table);
  const summary = listTables().find((item) => item.name === table);
  if (!summary) {
    throw new Error("table not found");
  }
  return summary;
}

export function getTableRows(table: string, query = "", rawLimit?: number): TableRowsResult {
  const db = getDb();
  const summary = getTableSummary(table);
  const trimmedQuery = query.trim();
  const limit = Math.min(Math.max(Number(rawLimit ?? 100) || 100, 1), 200);

  const whereParts: string[] = [];
  const params: unknown[] = [];

  if (trimmedQuery) {
    const matcher = `%${trimmedQuery}%`;
    const searchParts = summary.columns.map(
      (column) => `CAST(${quoteIdentifier(column.name)} AS TEXT) LIKE ? COLLATE NOCASE`
    );
    whereParts.push(`(${searchParts.join(" OR ")})`);
    params.push(...summary.columns.map(() => matcher));
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
  const orderColumns = summary.primaryKeys.length > 0 ? summary.primaryKeys : [summary.columns[0]?.name].filter(Boolean);
  const orderClause =
    orderColumns.length > 0
      ? `ORDER BY ${orderColumns.map((column) => `${quoteIdentifier(column)} ASC`).join(", ")}`
      : "";

  const totalRow = db
    .prepare(`SELECT COUNT(*) as count FROM ${quoteIdentifier(table)} ${whereClause}`)
    .get(...params) as { count: number };

  const rows = db
    .prepare(`SELECT * FROM ${quoteIdentifier(table)} ${whereClause} ${orderClause} LIMIT ?`)
    .all(...params, limit) as Record<string, unknown>[];

  return {
    table: summary,
    rows,
    totalRows: summary.rowCount,
    visibleRows: totalRow.count,
    query: trimmedQuery,
    limit
  };
}

export function updateTableRow(
  table: string,
  primaryKey: Record<string, unknown>,
  changes: Record<string, unknown>
) {
  const db = getDb();
  const summary = getTableSummary(table);

  if (summary.primaryKeys.length === 0) {
    throw new Error("table is read-only");
  }

  const pkValues = summary.primaryKeys.map((key) => primaryKey[key]);
  if (pkValues.some((value) => value === undefined)) {
    throw new Error("primary key is required");
  }

  const editableColumns = new Set(summary.columns.map((column) => column.name));
  const updateEntries = Object.entries(changes).filter(([key]) => editableColumns.has(key) && !summary.primaryKeys.includes(key));

  if (updateEntries.length === 0) {
    throw new Error("no editable changes provided");
  }

  const setClause = updateEntries.map(([key]) => `${quoteIdentifier(key)} = ?`).join(", ");
  const whereClause = summary.primaryKeys.map((key) => `${quoteIdentifier(key)} = ?`).join(" AND ");
  const values = updateEntries.map(([, value]) => value);

  const result = db
    .prepare(`UPDATE ${quoteIdentifier(table)} SET ${setClause} WHERE ${whereClause}`)
    .run(...values, ...pkValues);

  if (result.changes === 0) {
    throw new Error("row not found");
  }
}
