import { NextResponse } from "next/server";
import { organizerErrorResponse } from "@/lib/organizer/http";
import { listUnscheduledTasks } from "@/lib/organizer/repository";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, tasks: await listUnscheduledTasks() });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}
