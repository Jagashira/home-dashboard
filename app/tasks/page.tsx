import { TaskManager } from "./task-manager";
import { PlannerTasksTabs } from "../planner-tasks-tabs";

export const dynamic = "force-dynamic";

export default function TasksPage() {
  return (
    <section className="stack-lg">
      <PlannerTasksTabs current="tasks" />

      <section className="panel budget-hero">
        <div className="budget-grid-bg" aria-hidden="true" />
        <div className="budget-hero-body stack-sm">
          <p className="label-caption">TASK MANAGEMENT</p>
          <h1 className="budget-title">Tasks</h1>
        </div>
      </section>

      <TaskManager />
    </section>
  );
}
