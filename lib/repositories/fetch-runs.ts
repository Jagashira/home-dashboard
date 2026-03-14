import { getDb } from "@/lib/db";

export function startFetchRun(input: { days: number; totalRequested: number }) {
  const db = getDb();
  const now = new Date().toISOString();
  const runDate = now.slice(0, 10);
  const result = db
    .prepare(
      `
      INSERT INTO fetch_runs(run_date, days, total_requested, status, started_at)
      VALUES (?, ?, ?, 'running', ?)
    `
    )
    .run(runDate, input.days, input.totalRequested, now);
  return Number(result.lastInsertRowid);
}

export function finishFetchRun(input: {
  id: number;
  status: "success" | "failed";
  totalFetched: number;
  errorMessage?: string | null;
}): void {
  const db = getDb();
  db.prepare(
    `
    UPDATE fetch_runs
    SET status=?, total_fetched=?, error_message=?, finished_at=?
    WHERE id=?
  `
  ).run(
    input.status,
    input.totalFetched,
    input.errorMessage ?? null,
    new Date().toISOString(),
    input.id
  );
}

export function getLatestFetchRun() {
  const db = getDb();
  return db.prepare("SELECT * FROM fetch_runs ORDER BY id DESC LIMIT 1").get() as
    | {
        id: number;
        total_fetched: number;
        finished_at: string | null;
        status: string;
      }
    | undefined;
}
