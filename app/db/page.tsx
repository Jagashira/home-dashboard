import { APP_CONFIG } from "@/lib/config";
import Link from "next/link";
import { getTableCatalog, TABLE_DOMAIN_META, type TableDomainKey } from "@/lib/db-catalog";
import { listTables } from "@/lib/db-browser";

export default function DatabaseIndexPage() {
  const tables = listTables();
  const grouped = Object.keys(TABLE_DOMAIN_META).map((key) => {
    const domain = key as TableDomainKey;
    return {
      domain,
      meta: TABLE_DOMAIN_META[domain],
      tables: tables.filter((table) => getTableCatalog(table.name).domain === domain)
    };
  });

  return (
    <section className="stack-lg">
      <section className="panel hero">
        <p className="eyebrow">Database Browser</p>
        <h1>DBカテゴリ一覧</h1>
        <p>
          まず `news` や `billing` のようなカテゴリに入ってから、その中のテーブルを見る構成にしています。
          今見えているDBファイルは 1 つ、テーブルは {tables.length} つです。
          <br />
          <span className="inline-code">{APP_CONFIG.databasePath}</span>
        </p>
      </section>

      <section className="grid-2">
        {grouped.map((group) => (
          <article className="panel db-index-card" key={group.domain}>
            <div className="stack-sm">
              <p className="eyebrow">{group.meta.title}</p>
              <h2>{group.meta.description}</h2>
              <p className="status-text">
                {group.tables.length > 0
                  ? `${group.tables.length} テーブル`
                  : "このカテゴリのテーブルはまだありません"}
              </p>
            </div>
            <div className="db-index-card-meta">
              <span>{group.meta.title.toLowerCase()}</span>
              <span>{group.tables.length} tables</span>
            </div>
            <Link href={`/db/${group.domain}`}>カテゴリを開く</Link>
          </article>
        ))}
      </section>
    </section>
  );
}
