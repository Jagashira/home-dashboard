import Link from "next/link";
import { notFound } from "next/navigation";
import { listTables } from "@/lib/db-browser";
import { getTableCatalog, TABLE_DOMAIN_META, type TableDomainKey } from "@/lib/db-catalog";

type Props = {
  params: Promise<{ domain: string }>;
};

export default async function DatabaseDomainPage({ params }: Props) {
  const { domain: rawDomain } = await params;
  const domain = rawDomain as TableDomainKey;
  const domainMeta = TABLE_DOMAIN_META[domain];

  if (!domainMeta) {
    notFound();
  }

  const tables = listTables()
    .map((table) => ({ ...table, catalog: getTableCatalog(table.name) }))
    .filter((table) => table.catalog.domain === domain);

  return (
    <section className="stack-lg">
      <section className="panel hero">
        <p className="eyebrow">Database</p>
        <h1>{domainMeta.title}</h1>
        <p>{domainMeta.description}</p>
        <Link className="button-secondary" href="/db">
          DBトップへ戻る
        </Link>
      </section>

      {tables.length > 0 ? (
        <section className="grid-2">
          {tables.map((table) => (
            <article className="panel db-index-card" key={table.name}>
              <div className="stack-sm">
                <p className="eyebrow">{table.catalog.databaseLabel}</p>
                <h2>{table.catalog.title}</h2>
                <p>{table.catalog.summary}</p>
                <p className="status-text">{table.catalog.purpose}</p>
              </div>
              <div className="db-index-card-meta">
                <span>{table.rowCount} rows</span>
                <span>{table.columns.length} columns</span>
              </div>
              <Link href={`/db/${domain}/${table.name}`}>テーブルを見る</Link>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel">
          <p className="status-text">このカテゴリのテーブルはまだありません。</p>
        </section>
      )}
    </section>
  );
}
