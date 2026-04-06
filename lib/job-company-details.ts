import { prisma } from "@/lib/prisma";
import { JobCompanyDetail, JobEssay, JobSubmission, JobTimeline, JobUsefulLink } from "@/lib/job-hunting";
import { ensureDefaultJobCompanies, getJobCompanyById } from "@/lib/job-companies";

function toEssay(item: {
  id: string;
  companyId: string;
  question: string;
  answer: string;
  submittedAt: Date | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}): JobEssay {
  return {
    id: item.id,
    companyId: item.companyId,
    question: item.question,
    answer: item.answer,
    submittedAt: item.submittedAt?.toISOString() ?? null,
    note: item.note,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

function toSubmission(item: {
  id: string;
  companyId: string;
  itemType: string;
  status: string;
  submittedAt: Date | null;
  storagePath: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}): JobSubmission {
  return {
    id: item.id,
    companyId: item.companyId,
    itemType: item.itemType,
    status: item.status,
    submittedAt: item.submittedAt?.toISOString() ?? null,
    storagePath: item.storagePath,
    note: item.note,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

function toTimeline(item: {
  id: string;
  companyId: string;
  eventType: string;
  title: string;
  eventDate: Date;
  status: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}): JobTimeline {
  return {
    id: item.id,
    companyId: item.companyId,
    eventType: item.eventType,
    title: item.title,
    eventDate: item.eventDate.toISOString(),
    status: item.status,
    note: item.note,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

function toUsefulLink(item: {
  id: string;
  companyId: string;
  label: string;
  url: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}): JobUsefulLink {
  return {
    id: item.id,
    companyId: item.companyId,
    label: item.label,
    url: item.url,
    note: item.note,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

export async function getJobCompanyDetailById(id: string): Promise<JobCompanyDetail | null> {
  await ensureDefaultJobCompanies();
  const company = await getJobCompanyById(id);
  if (!company) return null;

  const [essays, submissions, timelines, usefulLinks] = await Promise.all([
    prisma.jobEssay.findMany({ where: { companyId: id }, orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }] }),
    prisma.jobSubmission.findMany({ where: { companyId: id }, orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }] }),
    prisma.jobTimeline.findMany({ where: { companyId: id }, orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }] }),
    prisma.jobUsefulLink.findMany({ where: { companyId: id }, orderBy: [{ createdAt: "desc" }] })
  ]);

  return {
    company,
    essays: essays.map(toEssay),
    submissions: submissions.map(toSubmission),
    timelines: timelines.map(toTimeline),
    usefulLinks: usefulLinks.map(toUsefulLink)
  };
}
