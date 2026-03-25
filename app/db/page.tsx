import Link from "next/link";
import { APP_CONFIG } from "@/lib/config";
import { listTables } from "@/lib/db-browser";

export default function DatabaseIndexPage() {
  const tables = listTables();

  return (
    <section className="stack-lg">
      <section className="panel hero">
        <p className="eyebrow">Database Browser</p>
        <h1>ローカルDB一覧</h1>
        <p>
          このアプリで現在見えているDBファイルは 1 つ、テーブルは {tables.length} つです。
          <br />
          <span className="inline-code">{APP_CONFIG.databasePath}</span>
        </p>
      </section>

      <section className="grid-3">
        {tables.map((table) => (
          <article className="panel" key={table.name}>
            <p className="eyebrow">Table</p>
            <h2>{table.name}</h2>
            <p>{table.rowCount} rows</p>
            <p className="status-text">{table.columns.map((column) => column.name).join(", ")}</p>
            <Link href={`/db/${table.name}`}>中身を見る</Link>
          </article>
        ))}
      </section>
    </section>
  );
}
