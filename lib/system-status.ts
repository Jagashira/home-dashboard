import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { APP_CONFIG } from "@/lib/config";

const execFileAsync = promisify(execFile);

type ItemState = "active" | "inactive" | "failed" | "running" | "stopped" | "missing" | "unknown";

export type SystemStatusSummary = {
  ok: boolean;
  host: {
    name: string;
    updatedAt: string;
  };
  services: Record<string, ItemState>;
  containers: Record<string, ItemState>;
  summary: {
    servicesOk: number;
    servicesTotal: number;
    containersRunning: number;
    containersTotal: number;
  };
};

function normalizeState(value: string, kind: "service" | "container"): ItemState {
  const normalized = value.trim().toLowerCase();

  if (kind === "service") {
    if (normalized === "active") return "active";
    if (normalized === "inactive") return "inactive";
    if (normalized === "failed") return "failed";
    if (normalized === "activating" || normalized === "deactivating") return "unknown";
    if (normalized === "unknown" || normalized === "not-found") return "missing";
    return "unknown";
  }

  if (normalized === "running") return "running";
  if (normalized === "exited" || normalized === "dead" || normalized === "paused" || normalized === "restarting") {
    return "stopped";
  }
  if (normalized === "not-found") return "missing";
  return "unknown";
}

async function getServiceState(name: string): Promise<ItemState> {
  try {
    const { stdout } = await execFileAsync("systemctl", ["is-active", name], {
      timeout: 5000
    });
    return normalizeState(stdout, "service");
  } catch (error) {
    const stderr = typeof error === "object" && error && "stderr" in error ? String(error.stderr ?? "") : "";
    if (stderr.includes("could not be found") || stderr.includes("not-found")) {
      return "missing";
    }
    const stdout = typeof error === "object" && error && "stdout" in error ? String(error.stdout ?? "") : "";
    return normalizeState(stdout || "unknown", "service");
  }
}

async function getContainerState(name: string): Promise<ItemState> {
  try {
    const { stdout } = await execFileAsync("docker", ["inspect", "-f", "{{.State.Status}}", name], {
      timeout: 5000
    });
    return normalizeState(stdout, "container");
  } catch (error) {
    const stderr = typeof error === "object" && error && "stderr" in error ? String(error.stderr ?? "") : "";
    if (stderr.includes("No such object")) {
      return "missing";
    }
    const stdout = typeof error === "object" && error && "stdout" in error ? String(error.stdout ?? "") : "";
    return normalizeState(stdout || "unknown", "container");
  }
}

export async function getSystemStatusSummary(): Promise<SystemStatusSummary> {
  const [serviceEntries, containerEntries] = await Promise.all([
    Promise.all(
      APP_CONFIG.monitoredServices.map(async (name) => [name, await getServiceState(name)] as const)
    ),
    Promise.all(
      APP_CONFIG.monitoredContainers.map(async (name) => [name, await getContainerState(name)] as const)
    )
  ]);

  const services = Object.fromEntries(serviceEntries);
  const containers = Object.fromEntries(containerEntries);
  const servicesOk = Object.values(services).filter((state) => state === "active").length;
  const containersRunning = Object.values(containers).filter((state) => state === "running").length;

  return {
    ok: true,
    host: {
      name: "home-server",
      updatedAt: new Date().toISOString()
    },
    services,
    containers,
    summary: {
      servicesOk,
      servicesTotal: serviceEntries.length,
      containersRunning,
      containersTotal: containerEntries.length
    }
  };
}
