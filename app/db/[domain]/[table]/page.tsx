import { notFound } from "next/navigation";
import { DatabaseTableView } from "@/components/db/database-table-view";
import { getTableSummary } from "@/lib/db-browser";
import { getTableCatalog, TABLE_DOMAIN_META, type TableDomainKey } from "@/lib/db-catalog";

type Props = {
  params: Promise<{ domain: string; table: string }>;
};

export default async function DatabaseTablePage({ params }: Props) {
  const { domain: rawDomain, table } = await params;
  const domain = rawDomain as TableDomainKey;

  if (!TABLE_DOMAIN_META[domain]) {
    notFound();
  }

  try {
    getTableSummary(table);
  } catch {
    notFound();
  }

  const catalog = getTableCatalog(table);
  if (catalog.domain !== domain) {
    notFound();
  }

  return <DatabaseTableView tableName={table} domain={domain} />;
}
