import { HomeDashboard } from "@/components/home/home-dashboard";
import { getHomeDashboardData } from "@/lib/home-dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const dashboard = await getHomeDashboardData();
  return <HomeDashboard dashboard={dashboard} />;
}
