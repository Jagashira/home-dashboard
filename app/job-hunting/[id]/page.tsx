import Link from "next/link";
import { notFound } from "next/navigation";
import { getJobCompanyDetailById } from "@/lib/job-company-details";
import { JobCompanyDetailPage } from "./company-detail-page";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function JobCompanyPage({ params }: Params) {
  const { id } = await params;
  const detail = await getJobCompanyDetailById(id);

  if (!detail) {
    notFound();
  }

  const company = detail.company;

  return (
    <section className="stack-lg">
      <section className="panel budget-hero job-hero">
        <div className="budget-grid-bg" aria-hidden="true" />
        <div className="budget-hero-body stack-md">
          <div className="job-company-page-head">
            <div className="stack-sm">
              <p className="label-caption">COMPANY</p>
              <h1 className="budget-title">{company.companyName}</h1>
            </div>
            <div className="job-hero-actions">
              <Link className="button-primary" href={company.myPageUrl} target="_blank" rel="noreferrer">
                マイページを開く
              </Link>
              <Link className="button-secondary" href="/job-hunting">
                一覧へ戻る
              </Link>
            </div>
          </div>
        </div>
      </section>

      <JobCompanyDetailPage initialData={detail} />
    </section>
  );
}
