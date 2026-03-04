import { refreshNewsFromFeeds } from "../lib/news";
import { prisma } from "../lib/prisma";

async function main() {
  const result = await refreshNewsFromFeeds();
  // Keep script output compact for cron/manual usage.
  console.log(`Fetched ${result.totalFetched}; inserted ${result.inserted}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
