export type WaterBillEntry = {
  id: string;
  billingMonth: string;
  amount: number;
  currency: "JPY";
  active: boolean;
  note?: string;
};

export const waterBillEntries: WaterBillEntry[] = [
  {
    id: "water-07-02-03",
    billingMonth: "07年02-03月",
    amount: 5236,
    currency: "JPY",
    active: true,
    note: "2か月ごとの請求額"
  },
  {
    id: "water-07-04-05",
    billingMonth: "07年04-05月",
    amount: 5236,
    currency: "JPY",
    active: true,
    note: "2か月ごとの請求額"
  },
  {
    id: "water-07-06-07",
    billingMonth: "07年06-07月",
    amount: 5236,
    currency: "JPY",
    active: true,
    note: "2か月ごとの請求額"
  },
  {
    id: "water-template-next",
    billingMonth: "07年08-09月",
    amount: 0,
    currency: "JPY",
    active: false,
    note: "次の請求が来たらここを更新"
  }
];

function parseBillingMonth(value: string) {
  const match = value.match(/(\d{2,4})\D+(\d{1,2})/);
  if (!match) return null;
  const rawYear = Number(match[1]);
  const year = match[1].length === 2 ? 2000 + rawYear : rawYear;
  const month = Number(match[2]);
  return {
    year,
    month,
    sortValue: year * 100 + month
  };
}

function compareWaterEntriesDesc(a: WaterBillEntry, b: WaterBillEntry) {
  const aMonth = parseBillingMonth(a.billingMonth)?.sortValue ?? 0;
  const bMonth = parseBillingMonth(b.billingMonth)?.sortValue ?? 0;
  return bMonth - aMonth;
}

export function getWaterDashboard() {
  const entries = [...waterBillEntries].sort(compareWaterEntriesDesc);
  const activeEntries = entries.filter((entry) => entry.active);
  const latestEntry = activeEntries[0] ?? null;
  const previousEntry = activeEntries[1] ?? null;
  const billedAverage =
    activeEntries.length > 0
      ? activeEntries.reduce((sum, entry) => sum + entry.amount, 0) / activeEntries.length
      : 0;

  return {
    entries,
    activeEntries,
    latestEntry,
    previousEntry,
    billedAverage,
    monthlyEquivalent: billedAverage / 2,
    yearlyEquivalent: billedAverage * 6,
    templates: entries.filter((entry) => !entry.active)
  };
}
