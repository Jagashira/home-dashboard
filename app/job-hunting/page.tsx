import { JobHuntingDashboard } from "./job-hunting-dashboard";
import { getJobHuntingStaticData } from "@/lib/job-hunting";
import { listJobSites } from "@/lib/job-sites";
import { listJobCompanies } from "@/lib/job-companies";

export const dynamic = "force-dynamic";

export default async function JobHuntingPage() {
  const [sites, companies] = await Promise.all([listJobSites(), listJobCompanies()]);
  const staticData = getJobHuntingStaticData(companies);
  const data = { ...staticData, sites, companies };

  return (
    <section className="stack-lg">
      <JobHuntingDashboard data={data} />
    </section>
  );
}
