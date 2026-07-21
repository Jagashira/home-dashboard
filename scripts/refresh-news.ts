import fs from "node:fs";
import path from "node:path";

function loadDotEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const rows = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const row of rows) {
    const trimmed = row.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadDotEnvFile();
  const { ensureNewsBootstrap } = await import("../lib/news-bootstrap");
  const { runFetchNews } = await import("../lib/services/fetch-news");

  ensureNewsBootstrap();
  const result = await runFetchNews();
  // Keep script output compact for cron/manual usage.
  console.log(
    `Fetched ${result.totalFetched}; inserted ${result.inserted}; semiconductor analyzed ${result.semiconductorAnalyzed}`
  );
  process.exit(0);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
