import { fetchNewsAndSummarize } from "../lib/news-dashboard";
import { prisma } from "../lib/prisma";

async function main() {
  const result = await fetchNewsAndSummarize();
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
