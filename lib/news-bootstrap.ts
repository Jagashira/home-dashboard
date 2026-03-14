import { initSchema, seedDefaults } from "@/lib/schema";

let initialized = false;

export function ensureNewsBootstrap() {
  if (initialized) return;
  initSchema();
  seedDefaults();
  initialized = true;
}

