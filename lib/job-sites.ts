import { prisma } from "@/lib/prisma";
import { DEFAULT_JOB_SITES, JobSite } from "@/lib/job-hunting";

function toJobSite(site: {
  id: string;
  name: string;
  url: string;
  purpose: string;
  loginId: string;
  password: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): JobSite {
  return {
    id: site.id,
    name: site.name,
    url: site.url,
    purpose: site.purpose,
    loginId: site.loginId,
    password: site.password,
    displayOrder: site.displayOrder,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString()
  };
}

export async function ensureDefaultJobSites() {
  const count = await prisma.jobSite.count();
  if (count > 0) return;

  await prisma.jobSite.createMany({
    data: DEFAULT_JOB_SITES
  });
}

export async function listJobSites() {
  await ensureDefaultJobSites();

  const sites = await prisma.jobSite.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
  });

  return sites.map(toJobSite);
}
