import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";

export type BudgetEntryType = "EXPENSE" | "INCOME";
export type DailyRangeOption = "today" | "7d" | "30d";

export type BudgetEntryInput = {
  entryType: BudgetEntryType;
  date: string;
  amount: number;
  category: string;
  paymentMethod: string;
  storeName: string;
  memo?: string;
  sourceAccount?: string;
};

type BudgetEntryRow = {
  id: string;
  entryType: BudgetEntryType;
  date: string;
  amount: number;
  category: string;
  paymentMethod: string;
  storeName: string;
  memo: string | null;
  sourceAccount: string | null;
  createdAt: string;
};

let budgetSchemaReady: Promise<void> | null = null;

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function dateToYmd(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function monthStart(ym: string): string {
  return `${ym}-01`;
}

function monthEnd(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const next = new Date(y, m, 1);
  next.setDate(0);
  return dateToYmd(next);
}

function clampAmount(value: number): number {
  return Math.max(0, Math.round(value));
}

async function ensureBudgetSchema() {
  if (budgetSchemaReady) {
    return budgetSchemaReady;
  }

  // Budget is added incrementally; create table lazily so existing DBs keep working without manual migration.
  budgetSchemaReady = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "BudgetEntry" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "entryType" TEXT NOT NULL,
        "date" TEXT NOT NULL,
        "amount" INTEGER NOT NULL,
        "category" TEXT NOT NULL,
        "paymentMethod" TEXT NOT NULL,
        "storeName" TEXT NOT NULL,
        "memo" TEXT,
        "sourceAccount" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "BudgetEntry_date_idx" ON "BudgetEntry"("date");
    `);
  })();

  return budgetSchemaReady;
}

export async function createBudgetEntry(input: BudgetEntryInput) {
  await ensureBudgetSchema();

  const id = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "BudgetEntry" (
      id, entryType, date, amount, category, paymentMethod, storeName, memo, sourceAccount
    ) VALUES (
      ${id},
      ${input.entryType},
      ${input.date},
      ${clampAmount(input.amount)},
      ${input.category},
      ${input.paymentMethod},
      ${input.storeName},
      ${input.memo ?? null},
      ${input.sourceAccount ?? null}
    )
  `;

  return { id };
}

export async function getBudgetDashboard(input: {
  month: string;
  date: string;
  dailyRange: DailyRangeOption;
}) {
  await ensureBudgetSchema();

  const today = new Date();
  const selectedDate = input.date || dateToYmd(today);
  const selectedMonth = input.month || selectedDate.slice(0, 7);

  const startOfMonth = monthStart(selectedMonth);
  const endOfMonth = monthEnd(selectedMonth);

  const dailyRangeStartDate = (() => {
    if (input.dailyRange === "today") return selectedDate;
    if (input.dailyRange === "7d") {
      const base = toDate(selectedDate);
      base.setDate(base.getDate() - 6);
      return dateToYmd(base);
    }
    const base = toDate(selectedDate);
    base.setDate(base.getDate() - 29);
    return dateToYmd(base);
  })();

  const monthlyTotalsRows = await prisma.$queryRaw<Array<{ income: number; expense: number }>>`
    SELECT
      COALESCE(SUM(CASE WHEN entryType = 'INCOME' THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN entryType = 'EXPENSE' THEN amount ELSE 0 END), 0) AS expense
    FROM "BudgetEntry"
    WHERE date >= ${startOfMonth} AND date <= ${endOfMonth}
  `;

  const monthlyIncomeByAccount = await prisma.$queryRaw<Array<{ account: string; total: number }>>`
    SELECT
      COALESCE(sourceAccount, '未分類') AS account,
      COALESCE(SUM(amount), 0) AS total
    FROM "BudgetEntry"
    WHERE entryType = 'INCOME'
      AND date >= ${startOfMonth}
      AND date <= ${endOfMonth}
    GROUP BY sourceAccount
    ORDER BY total DESC
  `;

  const monthlyExpenseByDay = await prisma.$queryRaw<Array<{ day: string; total: number }>>`
    SELECT date as day, COALESCE(SUM(amount), 0) as total
    FROM "BudgetEntry"
    WHERE entryType = 'EXPENSE'
      AND date >= ${startOfMonth}
      AND date <= ${endOfMonth}
    GROUP BY date
    ORDER BY date ASC
  `;

  const monthlyItems = await prisma.$queryRaw<BudgetEntryRow[]>`
    SELECT *
    FROM "BudgetEntry"
    WHERE entryType = 'EXPENSE'
      AND date >= ${startOfMonth}
      AND date <= ${endOfMonth}
    ORDER BY date DESC, createdAt DESC
    LIMIT 300
  `;

  const dailyItems = await prisma.$queryRaw<BudgetEntryRow[]>`
    SELECT *
    FROM "BudgetEntry"
    WHERE entryType = 'EXPENSE'
      AND date = ${selectedDate}
    ORDER BY createdAt DESC
  `;

  const dailyRangeGraph = await prisma.$queryRaw<Array<{ day: string; total: number }>>`
    SELECT date as day, COALESCE(SUM(amount), 0) as total
    FROM "BudgetEntry"
    WHERE entryType = 'EXPENSE'
      AND date >= ${dailyRangeStartDate}
      AND date <= ${selectedDate}
    GROUP BY date
    ORDER BY date ASC
  `;

  const monthTrendRows = await prisma.$queryRaw<Array<{ monthKey: string; expense: number; income: number }>>`
    SELECT
      substr(date, 1, 7) as monthKey,
      COALESCE(SUM(CASE WHEN entryType = 'EXPENSE' THEN amount ELSE 0 END), 0) as expense,
      COALESCE(SUM(CASE WHEN entryType = 'INCOME' THEN amount ELSE 0 END), 0) as income
    FROM "BudgetEntry"
    WHERE date >= ${dateToYmd(new Date(today.getFullYear(), today.getMonth() - 5, 1))}
      AND date <= ${selectedDate}
    GROUP BY substr(date, 1, 7)
    ORDER BY monthKey ASC
  `;

  const monthlyTotals = monthlyTotalsRows[0] ?? { income: 0, expense: 0 };

  return {
    selectedDate,
    selectedMonth,
    dailyRange: input.dailyRange,
    monthlyTotals,
    monthlyBalance: monthlyTotals.income - monthlyTotals.expense,
    monthlyIncomeByAccount,
    monthlyExpenseByDay,
    monthlyItems,
    dailyItems,
    dailyRangeGraph,
    monthTrendRows
  };
}
