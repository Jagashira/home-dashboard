export type FixedCostGroup = "rent" | "parking";
export type FixedCostCadence = "monthly" | "yearly" | "one_time";
export type FixedCostCategory =
  | "base_rent"
  | "management_fee"
  | "parking_fee"
  | "deposit"
  | "security_deposit"
  | "key_money"
  | "renewal_fee"
  | "other";

export type FixedCostEntry = {
  id: string;
  group: FixedCostGroup;
  name: string;
  category: FixedCostCategory;
  amount: number;
  currency: "JPY";
  cadence: FixedCostCadence;
  active: boolean;
  paidAtStart?: boolean;
  billingDay?: number | null;
  note?: string;
};

export const fixedCostEntries: FixedCostEntry[] = [
  {
    id: "rent-base-template",
    group: "rent",
    name: "家賃",
    category: "base_rent",
    amount: 50000,
    currency: "JPY",
    cadence: "monthly",
    active: true,
    billingDay: 27,
    note: "毎月固定"
  },
  {
    id: "rent-management-template",
    group: "rent",
    name: "管理費",
    category: "management_fee",
    amount: 2000,
    currency: "JPY",
    cadence: "monthly",
    active: true,
    billingDay: 27,
    note: "毎月固定"
  },
  {
    id: "rent-deposit-template",
    group: "rent",
    name: "敷金",
    category: "security_deposit",
    amount: 0,
    currency: "JPY",
    cadence: "one_time",
    active: false,
    paidAtStart: true,
    note: "入居時の一時費用"
  },
  {
    id: "rent-key-money-template",
    group: "rent",
    name: "礼金",
    category: "key_money",
    amount: 0,
    currency: "JPY",
    cadence: "one_time",
    active: false,
    paidAtStart: true,
    note: "入居時の一時費用"
  },
  {
    id: "parking-monthly-template",
    group: "parking",
    name: "駐車場代",
    category: "parking_fee",
    amount: 5000,
    currency: "JPY",
    cadence: "monthly",
    active: true,
    billingDay: 27,
    note: "月極駐車場"
  },
  {
    id: "parking-deposit-template",
    group: "parking",
    name: "駐車場デポジット",
    category: "deposit",
    amount: 0,
    currency: "JPY",
    cadence: "one_time",
    active: false,
    paidAtStart: true,
    note: "契約時の保証金"
  }
];

const groupLabels: Record<FixedCostGroup, string> = {
  rent: "家賃",
  parking: "駐車代"
};

const categoryLabels: Record<FixedCostCategory, string> = {
  base_rent: "家賃",
  management_fee: "管理費",
  parking_fee: "駐車料",
  deposit: "デポジット",
  security_deposit: "敷金",
  key_money: "礼金",
  renewal_fee: "更新料",
  other: "その他"
};

export function getFixedCostGroupLabel(group: FixedCostGroup) {
  return groupLabels[group];
}

export function getFixedCostCategoryLabel(category: FixedCostCategory) {
  return categoryLabels[category];
}

export function toMonthlyEquivalent(entry: FixedCostEntry) {
  if (entry.cadence === "monthly") return entry.amount;
  if (entry.cadence === "yearly") return entry.amount / 12;
  return 0;
}

export function toYearlyEquivalent(entry: FixedCostEntry) {
  if (entry.cadence === "monthly") return entry.amount * 12;
  if (entry.cadence === "yearly") return entry.amount;
  return 0;
}

export function getFixedCostDashboard(group: FixedCostGroup) {
  const entries = fixedCostEntries.filter((entry) => entry.group === group);
  const activeEntries = entries.filter((entry) => entry.active);
  const recurringEntries = activeEntries.filter((entry) => entry.cadence !== "one_time");
  const oneTimeEntries = activeEntries.filter((entry) => entry.cadence === "one_time");
  const templates = entries.filter((entry) => !entry.active);

  return {
    group,
    groupLabel: getFixedCostGroupLabel(group),
    entries,
    activeEntries,
    recurringEntries,
    oneTimeEntries,
    templates,
    monthlyTotal: recurringEntries.reduce((sum, entry) => sum + toMonthlyEquivalent(entry), 0),
    yearlyTotal: recurringEntries.reduce((sum, entry) => sum + toYearlyEquivalent(entry), 0),
    oneTimeTotal: oneTimeEntries.reduce((sum, entry) => sum + entry.amount, 0),
    nextBilling: [...recurringEntries]
      .filter((entry) => typeof entry.billingDay === "number")
      .sort((a, b) => (a.billingDay ?? 99) - (b.billingDay ?? 99))[0] ?? null
  };
}
