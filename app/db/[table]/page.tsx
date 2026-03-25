import { notFound } from "next/navigation";
import { DatabaseTableView } from "@/components/db/database-table-view";
import { getTableSummary } from "@/lib/db-browser";

type Props = {
  params: Promise<{ table: string }>;
};

export default async function DatabaseTablePage({ params }: Props) {
  const { table } = await params;

  try {
    getTableSummary(table);
  } catch {
    notFound();
  }

  return <DatabaseTableView tableName={table} />;
}
