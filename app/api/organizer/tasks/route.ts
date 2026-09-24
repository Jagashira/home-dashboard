import { NextRequest, NextResponse } from "next/server";
import { ORGANIZER_CATEGORIES, ORGANIZER_TASK_STATUSES } from "@/lib/organizer/constants";
import { organizerErrorResponse } from "@/lib/organizer/http";
import { createOrganizerTask, listOrganizerTasks } from "@/lib/organizer/repository";
import { validateTaskPayload } from "@/lib/organizer/validation";

export async function GET(request: NextRequest) {
  try {
    const statusParam = request.nextUrl.searchParams.get("status");
    const category = request.nextUrl.searchParams.get("category");
    const statuses = statusParam
      ? statusParam.split(",").filter((status) => ORGANIZER_TASK_STATUSES.includes(status as never))
      : undefined;
    const validCategory = category && ORGANIZER_CATEGORIES.includes(category as never) ? category : undefined;
    const tasks = await listOrganizerTasks({
      statuses,
      category: validCategory,
      sort: request.nextUrl.searchParams.get("sort") ?? undefined
    });
    return NextResponse.json({ ok: true, tasks });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const task = await createOrganizerTask(validateTaskPayload(await request.json()));
    return NextResponse.json({ ok: true, task }, { status: 201 });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

