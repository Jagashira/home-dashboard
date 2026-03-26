import { prisma } from "../lib/prisma";

async function main() {
  await prisma.shoppingItem.deleteMany();
  await prisma.inventoryItem.deleteMany();

  const inventoryItems = await prisma.$transaction([
    prisma.inventoryItem.create({
      data: {
        name: "米",
        category: "食品",
        location: "pantry",
        unit: "kg",
        currentQuantity: 1.2,
        minimumQuantity: 2,
        preferredBuyQuantity: 5,
        note: "無洗米を優先"
      }
    }),
    prisma.inventoryItem.create({
      data: {
        name: "卵",
        category: "食品",
        location: "冷蔵庫",
        unit: "個",
        currentQuantity: 4,
        minimumQuantity: 6,
        preferredBuyQuantity: 10,
        note: "できればLサイズ"
      }
    }),
    prisma.inventoryItem.create({
      data: {
        name: "牛乳",
        category: "食品",
        location: "冷蔵庫",
        unit: "本",
        currentQuantity: 1,
        minimumQuantity: 1,
        preferredBuyQuantity: 2,
        note: "低脂肪でも可"
      }
    }),
    prisma.inventoryItem.create({
      data: {
        name: "トイレットペーパー",
        category: "日用品",
        location: "洗面所",
        unit: "ロール",
        currentQuantity: 2,
        minimumQuantity: 4,
        preferredBuyQuantity: 12,
        note: "ダブル優先"
      }
    }),
    prisma.inventoryItem.create({
      data: {
        name: "食器用洗剤",
        category: "日用品",
        location: "キッチン",
        unit: "本",
        currentQuantity: 1,
        minimumQuantity: 1,
        preferredBuyQuantity: 1,
        note: "詰め替えでよい"
      }
    }),
    prisma.inventoryItem.create({
      data: {
        name: "コーヒー豆",
        category: "嗜好品",
        location: "pantry",
        unit: "袋",
        currentQuantity: 3,
        minimumQuantity: 1,
        preferredBuyQuantity: 2,
        note: "今は十分ある"
      }
    })
  ]);

  const byName = new Map(inventoryItems.map((item) => [item.name, item]));

  await prisma.shoppingItem.createMany({
    data: [
      {
        inventoryItemId: byName.get("米")?.id ?? null,
        name: "米",
        quantity: 5,
        unit: "kg",
        status: "todo",
        store: "オーケーストア",
        note: "特売なら2袋でも可"
      },
      {
        inventoryItemId: byName.get("卵")?.id ?? null,
        name: "卵",
        quantity: 10,
        unit: "個",
        status: "todo",
        store: "ライフ",
        note: ""
      },
      {
        inventoryItemId: byName.get("トイレットペーパー")?.id ?? null,
        name: "トイレットペーパー",
        quantity: 12,
        unit: "ロール",
        status: "todo",
        store: "ドラッグストア",
        note: "かさばるので最後に買う"
      },
      {
        inventoryItemId: byName.get("牛乳")?.id ?? null,
        name: "牛乳",
        quantity: 2,
        unit: "本",
        status: "done",
        store: "まいばすけっと",
        note: "昨日購入済み",
        purchasedAt: new Date("2026-03-25T10:00:00.000Z")
      },
      {
        inventoryItemId: null,
        name: "ゴミ袋",
        quantity: 1,
        unit: "箱",
        status: "todo",
        store: "ドラッグストア",
        note: "45L"
      }
    ]
  });

  const [inventoryCount, shoppingTodoCount, shoppingDoneCount] = await Promise.all([
    prisma.inventoryItem.count(),
    prisma.shoppingItem.count({ where: { status: "todo" } }),
    prisma.shoppingItem.count({ where: { status: "done" } })
  ]);

  console.log(`shop seed done: inventory=${inventoryCount}, todo=${shoppingTodoCount}, done=${shoppingDoneCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
