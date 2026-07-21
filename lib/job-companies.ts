import { prisma } from "@/lib/prisma";
import { DEFAULT_JOB_COMPANIES, JobCompany } from "@/lib/job-hunting";

function toJobCompany(company: {
  id: string;
  companyName: string;
  myPageUrl: string;
  loginId: string;
  password: string;
  storagePath: string | null;
  status: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): JobCompany {
  return {
    id: company.id,
    companyName: company.companyName,
    myPageUrl: company.myPageUrl,
    loginId: company.loginId,
    password: company.password,
    storagePath: company.storagePath ?? "",
    status: company.status as JobCompany["status"],
    displayOrder: company.displayOrder,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString()
  };
}

export async function ensureDefaultJobCompanies() {
  const count = await prisma.jobCompany.count();
  if (count > 0) return;

  await prisma.jobCompany.createMany({
    data: DEFAULT_JOB_COMPANIES
  });
}

export async function listJobCompanies() {
  await ensureDefaultJobCompanies();
  const companies = await prisma.jobCompany.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
  });
  return companies.map(toJobCompany);
}

export async function getJobCompanyById(id: string) {
  await ensureDefaultJobCompanies();
  const company = await prisma.jobCompany.findUnique({
    where: { id }
  });
  return company ? toJobCompany(company) : null;
}
