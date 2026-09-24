import Link from "next/link";

export function OrganizerNav({ current }: { current: "tasks" | "planner" }) {
  return (
    <nav className="organizer-nav" aria-label="Tasks and Planner">
      <Link className={current === "tasks" ? "is-active" : ""} href="/tasks">
        Tasks
      </Link>
      <Link className={current === "planner" ? "is-active" : ""} href="/planner">
        Planner
      </Link>
    </nav>
  );
}

