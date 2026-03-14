import { seedDefaults } from "../lib/schema";
import { initSchema } from "../lib/schema";

function main() {
  initSchema();
  seedDefaults();
  console.log("news seed done");
}

main();

