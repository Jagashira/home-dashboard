export type SubscriptionCadence = "monthly" | "yearly";

export type SubscriptionEntry = {
  id: string;
  name: string;
  category: "video" | "music" | "productivity" | "cloud" | "gaming" | "other";
  price: number;
  currency: "JPY";
  cadence: SubscriptionCadence;
  billingDay?: number | null;
  note?: string;
  active: boolean;
};

export const subscriptionEntries: SubscriptionEntry[] = [
  {
    id: "netflix-standard",
    name: "Netflix",
    category: "video",
    price: 1490,
    currency: "JPY",
    cadence: "monthly",
    billingDay: 3,
    note: "映像配信",
    active: true
  },
  {
    id: "youtube-premium",
    name: "YouTube Premium",
    category: "video",
    price: 1280,
    currency: "JPY",
    cadence: "monthly",
    billingDay: 11,
    note: "広告なし + Music",
    active: true
  },
  {
    id: "icloud-plus-200gb",
    name: "iCloud+ 200GB",
    category: "cloud",
    price: 450,
    currency: "JPY",
    cadence: "monthly",
    billingDay: 18,
    note: "写真バックアップ",
    active: true
  },
  {
    id: "chatgpt-plus",
    name: "ChatGPT Plus",
    category: "productivity",
    price: 3000,
    currency: "JPY",
    cadence: "monthly",
    billingDay: 22,
    note: "作業用",
    active: false
  },
  {
    id: "amazon-prime-student",
    name: "Amazon Prime Student",
    category: "other",
    price: 250,
    currency: "JPY",
    cadence: "monthly",
    note: "学生プラン",
    active: true
  },
  {
    id: "anytime-fitness-student",
    name: "Anytime Fitness",
    category: "other",
    price: 3850,
    currency: "JPY",
    cadence: "monthly",
    note: "学生プラン",
    active: true
  }
];

const categoryLabels: Record<SubscriptionEntry["category"], string> = {
  video: "映像",
  music: "音楽",
  productivity: "作業",
  cloud: "クラウド",
  gaming: "ゲーム",
  other: "その他"
};

export function getSubscriptionCategoryLabel(category: SubscriptionEntry["category"]) {
  return categoryLabels[category];
}

export function toMonthlyAmount(entry: SubscriptionEntry) {
  return entry.cadence === "monthly" ? entry.price : entry.price / 12;
}

export function toYearlyAmount(entry: SubscriptionEntry) {
  return entry.cadence === "yearly" ? entry.price : entry.price * 12;
}

export function getSubscriptionDashboard() {
  const activeEntries = subscriptionEntries.filter((entry) => entry.active);
  const monthlyTotal = activeEntries.reduce((sum, entry) => sum + toMonthlyAmount(entry), 0);
  const yearlyTotal = activeEntries.reduce((sum, entry) => sum + toYearlyAmount(entry), 0);
  const nextBilling = [...activeEntries]
    .filter((entry) => typeof entry.billingDay === "number")
    .sort((a, b) => (a.billingDay ?? 99) - (b.billingDay ?? 99))[0] ?? null;

  const grouped = Object.entries(
    activeEntries.reduce<Record<string, SubscriptionEntry[]>>((acc, entry) => {
      const label = getSubscriptionCategoryLabel(entry.category);
      acc[label] = acc[label] ?? [];
      acc[label].push(entry);
      return acc;
    }, {})
  ).map(([category, items]) => ({
    category,
    items: items.sort((a, b) => toMonthlyAmount(b) - toMonthlyAmount(a)),
    subtotalMonthly: items.reduce((sum, entry) => sum + toMonthlyAmount(entry), 0)
  }));

  return {
    entries: subscriptionEntries,
    activeEntries,
    monthlyTotal,
    yearlyTotal,
    nextBilling,
    grouped
  };
}
