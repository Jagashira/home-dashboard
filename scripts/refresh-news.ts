import { ensureNewsBootstrap } from "../lib/news-bootstrap";
import { runFetchNews } from "../lib/services/fetch-news";

async function main() {
  ensureNewsBootstrap();
  const result = await runFetchNews();
  // Keep script output compact for cron/manual usage.
  console.log(`Fetched ${result.totalFetched}; inserted ${result.inserted}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
