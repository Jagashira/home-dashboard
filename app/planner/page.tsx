import { PlannerDashboard } from "./planner-dashboard";

export const dynamic = "force-dynamic";

export default function PlannerPage() {
  return (
    <section className="stack-lg">
      <section className="panel budget-hero">
        <div className="budget-grid-bg" aria-hidden="true" />
        <div className="budget-hero-body stack-sm">
          <p className="label-caption">TODAY PLANNER</p>
          <h1 className="budget-title">Planner</h1>
        </div>
      </section>

      <PlannerDashboard />
    </section>
  );
}
