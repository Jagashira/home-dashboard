import Link from "next/link";

export function PlannerTasksTabs({ current }: { current: "planner" | "tasks" }) {
  return (
    <nav className="panel planner-task-tabs" aria-label="Planner and Tasks navigation">
      <Link className={current === "planner" ? "planner-task-tab is-active" : "planner-task-tab"} href="/planner">
        Planner
      </Link>
      <Link className={current === "tasks" ? "planner-task-tab is-active" : "planner-task-tab"} href="/tasks">
        Tasks
      </Link>
    </nav>
  );
}
