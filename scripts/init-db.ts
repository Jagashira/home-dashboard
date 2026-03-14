import { initSchema } from "../lib/schema";
import { seedDefaults } from "../lib/schema";

function main() {
  initSchema();
  seedDefaults();
  console.log("news db initialized");
}

main();

